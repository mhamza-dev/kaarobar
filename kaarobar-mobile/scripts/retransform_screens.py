#!/usr/bin/env python3
from __future__ import annotations

import re
from pathlib import Path

screens = Path("/Volumes/Data/Projects/POS/kaarobar-mobile/src/screens")

NAV_BLOCK = """import { useNavigation, useRoute } from "@react-navigation/native";
import type { NavigationProp, ParamListBase } from "@react-navigation/native";
import { replacePath, pushPath } from "../lib/nav";
"""


def transform(text: str) -> str:
    text = text.replace("../../lib/", "../lib/")
    text = text.replace("../../components/", "../components/")
    text = text.replace('require("../assets/', 'require("../../assets/')

    needs_nav = bool(
        re.search(r"expo-router|router\.|Link |useLocalSearchParams|Redirect", text)
    )

    text = re.sub(
        r'^import\s+\{[^}]*\}\s+from\s+[\'"]expo-router[\'"];\s*\n',
        "",
        text,
        flags=re.M,
    )
    text = re.sub(
        r'^import\s+[^\n]*from\s+[\'"]expo-router[\'"];\s*\n',
        "",
        text,
        flags=re.M,
    )

    text = re.sub(
        r'^import\s+\*\s+as\s+ImagePicker\s+from\s+[\'"]expo-image-picker[\'"];\s*\n',
        'import { pickImageFromLibrary } from "../lib/imagePicker";\n',
        text,
        flags=re.M,
    )

    text = re.sub(
        r"const res = await ImagePicker\.launchImageLibraryAsync\(\{[^}]*\}\);\s*\n\s*if \(res\.canceled \|\| !res\.assets\[0\]\) return;\s*\n\s*const asset = res\.assets\[0\];",
        "const asset = await pickImageFromLibrary();\n    if (!asset) return;",
        text,
    )

    text = re.sub(
        r"async function pickImage\(\) \{\s*const res = await ImagePicker\.launchImageLibraryAsync\(\{[^}]*\}\);\s*if \(!res\.canceled && res\.assets\[0\]\) \{\s*setForm\(\(f\) => \(\{ \.\.\.f, image_url: res\.assets\[0\]\.uri \}\)\);\s*\}\s*\}",
        """async function pickImage() {
    const asset = await pickImageFromLibrary();
    if (asset) {
      setForm((f) => ({ ...f, image_url: asset.uri }));
    }
  }""",
        text,
        flags=re.S,
    )

    text = text.replace("asset.mimeType", "asset.type")

    if needs_nav and 'from "../lib/nav"' not in text:
        lines = text.splitlines(keepends=True)
        idx = 0
        for i, line in enumerate(lines):
            if line.startswith("import "):
                idx = i + 1
        lines.insert(idx, NAV_BLOCK)
        text = "".join(lines)

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
    text = text.replace("router.back()", "navigation.goBack()")
    text = text.replace("router.setParams(", "navigation.setParams(")

    text = re.sub(
        r"const params = useLocalSearchParams<[^>]+>\(\);?",
        "const route = useRoute();\n  const params = (route.params || {}) as Record<string, string | undefined>;",
        text,
    )
    text = re.sub(
        r"const \{ id \} = useLocalSearchParams<[^>]+>\(\);?",
        "const route = useRoute();\n  const { id } = (route.params || {}) as { id: string };",
        text,
    )

    def link_repl(m: re.Match[str]) -> str:
        href, rest, body = m.group(1), m.group(2), m.group(3)
        style = ""
        sm = re.search(r"style=\{([^}]+)\}", rest)
        if sm:
            style = " style={" + sm.group(1) + "}"
        return (
            '<Pressable onPress={() => pushPath(navigation, "'
            + href
            + '")}><Text'
            + style
            + ">"
            + body
            + "</Text></Pressable>"
        )

    text = re.sub(
        r'<Link\s+href=["\']([^"\']+)["\']([^>]*)>(.*?)</Link>',
        link_repl,
        text,
        flags=re.S,
    )

    def link_expr(m: re.Match[str]) -> str:
        return (
            "<Pressable onPress={() => pushPath(navigation, String("
            + m.group(1)
            + "))}><Text>"
            + m.group(3)
            + "</Text></Pressable>"
        )

    text = re.sub(
        r"<Link\s+href=\{([^}]+)\}([^>]*)>(.*?)</Link>",
        link_expr,
        text,
        flags=re.S,
    )

    text = re.sub(r"<Stack\.Screen[^/]*/>\s*", "", text)
    text = re.sub(
        r"<Stack\.Screen[^>]*>.*?</Stack\.Screen>\s*", "", text, flags=re.S
    )

    if (
        "replacePath(navigation" in text
        or "pushPath(navigation" in text
        or "navigation.setParams" in text
        or "navigation.goBack" in text
    ) and "const navigation = useNavigation" not in text:
        text = re.sub(
            r"(export default function \w+\([^)]*\) \{\n)",
            r"\1  const navigation = useNavigation<NavigationProp<ParamListBase>>();\n",
            text,
            count=1,
        )

    m = re.search(r'import \{([^}]+)\} from "react-native";', text)
    if m and "<Pressable" in text and "Pressable" not in m.group(1):
        text = text.replace(
            m.group(0),
            'import {' + m.group(1).rstrip() + ", Pressable} from \"react-native\";",
            1,
        )

    return text


def main() -> None:
    skip = {"SalesScreen.tsx", "ProfileScreen.tsx"}
    for path in sorted(screens.glob("*.tsx")):
        if path.name in skip:
            continue
        raw = path.read_text(encoding="utf-8")
        new = transform(raw)
        path.write_text(new, encoding="utf-8")
        print("ok", path.name)


if __name__ == "__main__":
    main()
