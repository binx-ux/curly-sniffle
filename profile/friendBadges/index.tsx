/*
 * Vencord, a Discord client mod
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import {
    addProfileBadge,
    BadgePosition,
    BadgeUserArgs,
    ProfileBadge,
    removeProfileBadge,
} from "@api/Badges";
import {
    ApplicationCommandInputType,
    ApplicationCommandOptionType,
    findOption,
    sendBotMessage,
} from "@api/Commands";
import * as DataStore from "@api/DataStore";
import { definePluginSettings } from "@api/Settings";
import definePlugin, { OptionType } from "@utils/types";

type RegistryBadge = { tooltip: string; badge: string; };
type Registry = Record<string, RegistryBadge[]>;
type LocalBadge = { userId: string; tooltip: string; badge: string; };

const LOCAL_KEY = "FriendBadges_local";
const REFRESH_MS = 1000 * 60 * 30;

const settings = definePluginSettings({
    registryUrl: {
        type: OptionType.STRING,
        description: "URL to a shared badge JSON registry",
        default: "",
    },
});

let remote: Registry = {};
let local: LocalBadge[] = [];
let timer: any;

const badgeHook: ProfileBadge = {
    id: "friend_badges_hook",
    position: BadgePosition.START,
    getBadges({ userId }: BadgeUserArgs) {
        const out: ProfileBadge[] = [];

        const fromRemote = remote[userId] ?? [];
        fromRemote.forEach((b, i) => {
            out.push({
                id: `friend_remote_${userId}_${i}`,
                description: b.tooltip,
                iconSrc: b.badge,
                position: BadgePosition.START,
            });
        });

        local
            .filter(b => b.userId === userId)
            .forEach((b, i) => {
                out.push({
                    id: `friend_local_${userId}_${i}`,
                    description: b.tooltip,
                    iconSrc: b.badge,
                    position: BadgePosition.START,
                });
            });

        return out;
    },
};

async function loadLocal() {
    local = (await DataStore.get(LOCAL_KEY)) ?? [];
}

async function saveLocal() {
    await DataStore.set(LOCAL_KEY, local);
}

async function loadRemote(force = false) {
    const url = settings.store.registryUrl.trim();
    if (!url) {
        remote = {};
        return;
    }

    try {
        const init: RequestInit = force ? { cache: "no-cache" } : {};
        remote = await fetch(url, init).then(r => {
            if (!r.ok) throw new Error(String(r.status));
            return r.json();
        });
    } catch {
        // keep last good cache
    }
}

export default definePlugin({
    name: "FriendBadges",
    description: "Custom profile badges from a shared registry and local /friendbadge commands",
    authors: [{ name: "kyn", id: 839321627938390047n }],
    settings,
    dependencies: ["BadgeAPI", "CommandsAPI"],

    async start() {
        await loadLocal();
        await loadRemote();
        addProfileBadge(badgeHook);
        clearInterval(timer);
        timer = setInterval(() => loadRemote(), REFRESH_MS);
    },

    stop() {
        removeProfileBadge(badgeHook);
        clearInterval(timer);
    },

    commands: [
        {
            name: "friendbadge",
            description: "Manage local friend badges",
            inputType: ApplicationCommandInputType.BUILT_IN,
            options: [
                {
                    name: "set",
                    description: "Add or replace a local badge for a user",
                    type: ApplicationCommandOptionType.SUB_COMMAND,
                    options: [
                        {
                            name: "user",
                            description: "User to badge",
                            type: ApplicationCommandOptionType.USER,
                            required: true,
                        },
                        {
                            name: "image",
                            description: "Badge image URL",
                            type: ApplicationCommandOptionType.STRING,
                            required: true,
                        },
                        {
                            name: "tooltip",
                            description: "Hover text",
                            type: ApplicationCommandOptionType.STRING,
                            required: true,
                        },
                    ],
                },
                {
                    name: "remove",
                    description: "Remove local badges for a user",
                    type: ApplicationCommandOptionType.SUB_COMMAND,
                    options: [
                        {
                            name: "user",
                            description: "User to clear",
                            type: ApplicationCommandOptionType.USER,
                            required: true,
                        },
                    ],
                },
                {
                    name: "list",
                    description: "List local badges",
                    type: ApplicationCommandOptionType.SUB_COMMAND,
                    options: [],
                },
            ],
            async execute(args, ctx) {
                const sub = args[0]?.name;

                if (sub === "set") {
                    const userId = findOption(args[0].options, "user", "") as string;
                    const image = findOption(args[0].options, "image", "") as string;
                    const tooltip = findOption(args[0].options, "tooltip", "") as string;

                    local = local.filter(b => b.userId !== userId);
                    local.push({ userId, badge: image, tooltip });
                    await saveLocal();

                    sendBotMessage(ctx.channel.id, {
                        content: `Set local badge on <@${userId}> — **${tooltip}**`,
                    });
                    return;
                }

                if (sub === "remove") {
                    const userId = findOption(args[0].options, "user", "") as string;
                    const before = local.length;
                    local = local.filter(b => b.userId !== userId);
                    await saveLocal();

                    sendBotMessage(ctx.channel.id, {
                        content:
                            before === local.length
                                ? `No local badges for <@${userId}>.`
                                : `Cleared local badges for <@${userId}>.`,
                    });
                    return;
                }

                if (sub === "list") {
                    if (!local.length) {
                        sendBotMessage(ctx.channel.id, { content: "No local badges yet." });
                        return;
                    }

                    const lines = local.map(
                        b => `• <@${b.userId}> — **${b.tooltip}**\n  ${b.badge}`
                    );
                    sendBotMessage(ctx.channel.id, {
                        content: `**Local badges (${local.length})**\n` + lines.join("\n"),
                    });
                }
            },
        },
    ],
});
