import { definePluginSettings } from "@api/Settings";
import { OptionType } from "@utils/types";

import { BadgeSettings } from "./settingsUI";

export type CustomBadge = { id: string; iconSrc: string; description: string; };

export const settings = definePluginSettings({
    panel: {
        type: OptionType.COMPONENT,
        component: () => <BadgeSettings />,
    },
    enabledBadges: {
        type: OptionType.CUSTOM,
        default: "" as string,
    },
    customBadges: {
        type: OptionType.CUSTOM,
        default: "[]" as string,
    },
});

export function parseIdList(raw: string): string[] {
    return raw
        .split(",")
        .map(s => s.trim().toLowerCase())
        .filter(Boolean);
}

export function parseCustom(raw = settings.store.customBadges): CustomBadge[] {
    try {
        const parsed = JSON.parse(raw || "[]");
        if (!Array.isArray(parsed)) return [];
        return parsed.filter(b => b?.id && b?.iconSrc && b?.description);
    } catch {
        return [];
    }
}

export function setEnabledList(ids: string[]) {
    settings.store.enabledBadges = [...new Set(ids)].join(",");
}

export function setCustomList(list: CustomBadge[]) {
    settings.store.customBadges = JSON.stringify(list);
}
