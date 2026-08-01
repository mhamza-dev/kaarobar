#!/usr/bin/env python3
"""Rewrite Expo Router / path imports for RN CLI src layout."""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"

NAV_IMPORT = """import { useNavigation, useRoute } from "@react-navigation/native";
import type { NavigationProp, ParamListBase, RouteProp } from "@react-navigation/native";
import { replacePath, pushPath } from "../lib/nav";
"""

SCREEN_NAV_HOOK = """
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
"""


def fix_paths(text: str, kind: str) -> str:
    if kind == "screen":
        text = text.replace("../../lib/", "../lib/")
        text = text.replace("../../components/", "../components/")
        text = text.replace("../lib/", "../lib/")  # noop
        text = text.replace('"../assets/', '"../../assets/')
        text = text.replace("'../assets/", "'../../assets/")
    elif kind == "component":
        text = text.replace("../assets/", "../../assets/")
        text = text.replace('"../lib/', '"../lib/')
    return text


def strip_expo_router(text: str) -> str:
    # Remove expo-router imports; inject navigation helpers once.
    text = re.sub(
        r'^import\s+\{[^}]*\}\s+from\s+[\'"]expo-router[\'"];?\n',
        "",
        text,
        flags=re.M,
    )
    text = re.sub(
        r'^import\s+\*\s+as\s+ImagePicker\s+from\s+[\'"]expo-image-picker[\'"];?\n',
        'import { launchImageLibrary } from "react-native-image-picker";\n',
        text,
        flags=re.M,
    )
    text = text.replace(
        'from "expo-status-bar"',
        'from "react-native" /* status-bar via RN */',
    )
    if "useNavigation" not in text and (
        "router." in text or "Link " in text or "useLocalSearchParams" in text
    ):
        # Insert after first import block line
        lines = text.splitlines(keepends=True)
        insert_at = 0
        for i, line in enumerate(lines):
            if line.startswith("import "):
                insert_at = i + 1
            elif insert_at and not line.startswith("import ") and line.strip():
                break
        lines.insert(insert_at, NAV_IMPORT + "\n")
        text = "".join(lines)

    # ImagePicker API swap
    text = re.sub(
        r"ImagePicker\.launchImageLibraryAsync\(\{([^}]*)\}\)",
        r"new Promise((resolve) => launchImageLibrary({\1, mediaType: 'photo', quality: 0.8}, resolve))",
        text,
        flags=re.S,
    )
    # Common pattern adjustments for image picker result
    text = text.replace("res.canceled", "res.didCancel")
    text = text.replace(
        "ImagePicker.MediaTypeOptions.Images",
        "'photo' as const",
    )

    # router.replace / push
    text = re.sub(
        r"router\.replace\((['\"])([^'\"]+)\1\)",
        r"replacePath(navigation, \1\2\1)",
        text,
    )
    text = re.sub(
        r"router\.push\((['\"])([^'\"]+)\1\)",
        r"pushPath(navigation, \1\2\1)",
        text,
    )
    text = re.sub(
        r"router\.push\(\{[^}]*pathname:\s*([^\},]+)[^}]*\}\)",
        r"pushPath(navigation, String(\1))",
        text,
    )
    text = text.replace("router.back()", "navigation.goBack()")

    # useLocalSearchParams → route.params
    if "useLocalSearchParams" in text or "params." in text:
        text = text.replace(
            "const params = useLocalSearchParams",
            "const route = useRoute();\n  const params = (route.params || {}) as any; // was useLocalSearchParams",
        )
        # If we left a broken call, fix common forms
        text = re.sub(
            r"const params = useLocalSearchParams<[^>]+>\(\);?",
            "const route = useRoute();\n  const params = (route.params || {}) as Record<string, string>;",
            text,
        )

    # Strip <Link> usage → Pressable-like: leave as Text with onPress where simple
    # Convert Link href="/x" children to Pressable
    text = re.sub(
        r"<Link\s+href=\{?['\"]([^'\"]+)['\"]\}?[^>]*style=(\{[^}]+\}|[^\s>]+)[^>]*>(.*?)</Link>",
        r'<Pressable onPress={() => pushPath(navigation, "\1")}><Text style={\2}>\3</Text></Pressable>',
        text,
        flags=re.S,
    )
    text = re.sub(
        r"<Link\s+href=\{?['\"]([^'\"]+)['\"]\}?[^>]*>(.*?)</Link>",
        r'<Pressable onPress={() => pushPath(navigation, "\1")}><Text>\2</Text></Pressable>',
        text,
        flags=re.S,
    )
    text = re.sub(
        r"<Link\s+href=\{([^}]+)\}[^>]*>(.*?)</Link>",
        r"<Pressable onPress={() => pushPath(navigation, String(\1))}><Text>\2</Text></Pressable>",
        text,
        flags=re.S,
    )

    # Inject navigation hook into default export function bodies if missing
    if "replacePath(navigation" in text or "pushPath(navigation" in text:
        if "const navigation = useNavigation" not in text:
            text = re.sub(
                r"(export default function \w+\([^)]*\) \{)",
                r"\1" + SCREEN_NAV_HOOK,
                text,
                count=1,
            )

    # Remove Stack from expo-router leftover usages (header options)
    text = re.sub(r"<Stack\.Screen[^/]*/>\s*", "", text)
    text = re.sub(r"<Stack\.Screen[^>]*>.*?</Stack\.Screen>\s*", "", text, flags=re.S)

    # Remove consumer / Buyer references lightly
    text = re.sub(
        r'import\s+Buyer\w+\s+from\s+[\'"][^\'"]+[\'"];?\n',
        "",
        text,
    )

    return text


def process_file(path: Path, kind: str) -> None:
    raw = path.read_text(encoding="utf-8")
    text = fix_paths(raw, kind)
    text = strip_expo_router(text)
    if text != raw:
        path.write_text(text, encoding="utf-8")
        print(f"updated {path.relative_to(ROOT)}")


def main() -> None:
    for path in (SRC / "screens").glob("*.tsx"):
        process_file(path, "screen")
    for path in (SRC / "components").rglob("*.tsx"):
        process_file(path, "component")
    for path in (SRC / "lib").rglob("*.{ts,tsx}"):
        # only path fixes for lib
        raw = path.read_text(encoding="utf-8")
        text = raw
        text = text.replace("EXPO_PUBLIC_API_URL", "API_URL")
        # Keep process.env.API_URL || process.env.EXPO...
        if "process.env.EXPO_PUBLIC_API_URL" in raw:
            text = text.replace(
                'process.env.EXPO_PUBLIC_API_URL || "http://localhost:4000/api/v1"',
                'process.env.API_URL || process.env.EXPO_PUBLIC_API_URL || "http://localhost:4000/api/v1"',
            )
        if text != raw:
            path.write_text(text, encoding="utf-8")
            print(f"updated {path.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
