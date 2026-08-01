#!/usr/bin/env python3
"""Transform Expo buyer sources for kaarobar-customer RN CLI."""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path("/Volumes/Data/Projects/POS/kaarobar-customer/src")

NAV_BLOCK = """import { useNavigation, useRoute, useFocusEffect } from "@react-navigation/native";
import type { NavigationProp, ParamListBase } from "@react-navigation/native";
import { replacePath, pushPath } from "../lib/nav";
"""


def transform(text: str, kind: str) -> str:
    if kind == "screen":
        text = text.replace("../../lib/", "../lib/")
        text = text.replace("../../components/", "../components/")
    text = text.replace('require("../assets/', 'require("../../assets/')
    text = text.replace("from 'expo-router'", 'from "@react-navigation/native" /* was expo-router */')

    needs_nav = bool(re.search(r"expo-router|router\.|Link |useLocalSearchParams|Redirect|useFocusEffect", text))

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

    if needs_nav and 'from "../lib/nav"' not in text and 'from "../../lib/nav"' not in text:
        # components use ../lib/nav too if in components/
        nav = NAV_BLOCK
        if kind == "component":
            nav = nav.replace("../lib/nav", "../lib/nav")
        lines = text.splitlines(keepends=True)
        idx = 0
        for i, line in enumerate(lines):
            if line.startswith("import "):
                idx = i + 1
        lines.insert(idx, nav)
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
    text = re.sub(
        r"<Link\s+href=\{([^}]+)\}([^>]*)>(.*?)</Link>",
        lambda m: (
            "<Pressable onPress={() => pushPath(navigation, String("
            + m.group(1)
            + "))}><Text>"
            + m.group(3)
            + "</Text></Pressable>"
        ),
        text,
        flags=re.S,
    )

    if (
        "replacePath(navigation" in text
        or "pushPath(navigation" in text
        or "navigation.goBack" in text
    ) and "const navigation = useNavigation" not in text:
        text = re.sub(
            r"(export default function \w+\([^)]*\) \{\n)",
            r"\1  const navigation = useNavigation<NavigationProp<ParamListBase>>();\n",
            text,
            count=1,
        )
        # also for named exports like export function BuyerX
        text = re.sub(
            r"(export function \w+\([^)]*\) \{\n)",
            r"\1  const navigation = useNavigation<NavigationProp<ParamListBase>>();\n",
            text,
            count=1,
        )

    m = re.search(r'import \{([^}]+)\} from "react-native";', text)
    if m and "<Pressable" in text and "Pressable" not in m.group(1):
        text = text.replace(
            m.group(0),
            "import {" + m.group(1).rstrip() + ', Pressable} from "react-native";',
            1,
        )
    if m and "<Text" in text and "Text" not in m.group(1) and "<Pressable" in text:
        # may already have Text
        pass

    text = text.replace(
        'process.env.EXPO_PUBLIC_API_URL || "http://localhost:4000/api/v1"',
        'process.env.API_URL || process.env.EXPO_PUBLIC_API_URL || "http://localhost:4000/api/v1"',
    )
    return text


def main() -> None:
    for path in (ROOT / "screens").glob("*.tsx"):
        path.write_text(transform(path.read_text(), "screen"))
        print("screen", path.name)
    for path in (ROOT / "components").glob("*.tsx"):
        path.write_text(transform(path.read_text(), "component"))
        print("comp", path.name)
    for path in (ROOT / "lib").rglob("*.ts*"):
        raw = path.read_text()
        new = raw.replace(
            'process.env.EXPO_PUBLIC_API_URL || "http://localhost:4000/api/v1"',
            'process.env.API_URL || process.env.EXPO_PUBLIC_API_URL || "http://localhost:4000/api/v1"',
        )
        if new != raw:
            path.write_text(new)
            print("lib", path.name)


if __name__ == "__main__":
    main()
