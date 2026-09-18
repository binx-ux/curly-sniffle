/*
 * Vencord, a Discord client mod
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

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
import definePlugin from "@utils/types";
import { UserStore } from "@webpack/common";

import { CATALOG_BY_ID, catalogIdsHelp } from "./catalog";
import {
    parseCustom,
    parseIdList,
    setCustomList,
    setEnabledList,
    settings,
} from "./store";

type PerUserMap = Record<string, string[]>;

const STORE_KEY = "ClientBadges_perUser";

let perUser: PerUserMap = {};

async function loadPerUser() {
    perUser = (await DataStore.get(STORE_KEY)) ?? {};
}

async function savePerUser() {
    await DataStore.set(STORE_KEY, perUser);
}

function badgesForUser(userId: string): ProfileBadge[] {
    const me = UserStore.getCurrentUser()?.id;
    const out: ProfileBadge[] = [];
    const seen = new Set<string>();

    function pushCatalog(id: string, prefix: string) {
        const entry = CATALOG_BY_ID.get(id);
        if (!entry || seen.has(entry.id)) return;
        seen.add(entry.id);
        out.push({
            id: `${prefix}_${entry.id}`,
            description: entry.name,
            iconSrc: entry.iconSrc,
            position: BadgePosition.START,
        });
    }

    if (userId === me) {
        for (const id of parseIdList(settings.store.enabledBadges))
            pushCatalog(id, "cb_self");

        parseCustom().forEach((b, i) => {
            const key = `cb_custom_${b.id}_${i}`;
            if (seen.has(key)) return;
            seen.add(key);
            out.push({
                id: key,
                description: b.description,
                iconSrc: b.iconSrc,
                position: BadgePosition.START,
            });
        });
    }

    for (const id of perUser[userId] ?? [])
        pushCatalog(id, `cb_user_${userId}`);

    return out;
}

const badgeHook: ProfileBadge = {
    id: "client_badges_hook",
    position: BadgePosition.START,
    getBadges({ userId }: BadgeUserArgs) {
        return badgesForUser(userId);
    },
};

export default definePlugin({
    name: "ClientBadges",
    description: "Put any Discord badges (or custom images) on profiles. Client-side only, only you see them.",
    authors: [{ name: "kyn", id: 839321627938390047n }],
    dependencies: ["BadgeAPI", "CommandsAPI"],
    settings,

    async start() {
        await loadPerUser();
        addProfileBadge(badgeHook);
    },

    stop() {
        removeProfileBadge(badgeHook);
    },

    commands: [
        {
            name: "clientbadge",
            description: "Manage client-side profile badges",
            inputType: ApplicationCommandInputType.BUILT_IN,
            options: [
                {
                    name: "enable",
                    description: "Enable a catalog badge on yourself",
                    type: ApplicationCommandOptionType.SUB_COMMAND,
                    options: [
                        {
                            name: "id",
                            description: "Badge id (staff, nitro, early_supporter, …)",
                            type: ApplicationCommandOptionType.STRING,
                            required: true,
                        },
                    ],
                },
                {
                    name: "disable",
                    description: "Disable a catalog badge on yourself",
                    type: ApplicationCommandOptionType.SUB_COMMAND,
                    options: [
                        {
                            name: "id",
                            description: "Badge id",
                            type: ApplicationCommandOptionType.STRING,
                            required: true,
                        },
                    ],
                },
                {
                    name: "give",
                    description: "Show a catalog badge on someone (local only)",
                    type: ApplicationCommandOptionType.SUB_COMMAND,
                    options: [
                        {
                            name: "user",
                            description: "User",
                            type: ApplicationCommandOptionType.USER,
                            required: true,
                        },
                        {
                            name: "id",
                            description: "Badge id",
                            type: ApplicationCommandOptionType.STRING,
                            required: true,
                        },
                    ],
                },
                {
                    name: "take",
                    description: "Remove a catalog badge you gave someone",
                    type: ApplicationCommandOptionType.SUB_COMMAND,
                    options: [
                        {
                            name: "user",
                            description: "User",
                            type: ApplicationCommandOptionType.USER,
                            required: true,
                        },
                        {
                            name: "id",
                            description: "Badge id (omit to clear all)",
                            type: ApplicationCommandOptionType.STRING,
                            required: false,
                        },
                    ],
                },
                {
                    name: "custom",
                    description: "Add a custom image badge on yourself",
                    type: ApplicationCommandOptionType.SUB_COMMAND,
                    options: [
                        {
                            name: "image",
                            description: "Image URL",
                            type: ApplicationCommandOptionType.STRING,
                            required: true,
                        },
                        {
                            name: "tooltip",
                            description: "Hover text",
                            type: ApplicationCommandOptionType.STRING,
                            required: true,
                        },
                        {
                            name: "id",
                            description: "Unique id (optional)",
                            type: ApplicationCommandOptionType.STRING,
                            required: false,
                        },
                    ],
                },
                {
                    name: "list",
                    description: "List enabled badges and catalog ids",
                    type: ApplicationCommandOptionType.SUB_COMMAND,
                    options: [],
                },
            ],
            async execute(args, ctx) {
                const sub = args[0]?.name;

                if (sub === "enable") {
                    const id = (findOption(args[0].options, "id", "") as string).trim().toLowerCase();
                    if (!CATALOG_BY_ID.has(id)) {
                        sendBotMessage(ctx.channel.id, {
                            content: `Unknown badge \`${id}\`.\n\n**ids:**\n${catalogIdsHelp()}`,
                        });
                        return;
                    }
                    const next = parseIdList(settings.store.enabledBadges);
                    if (!next.includes(id)) next.push(id);
                    setEnabledList(next);
                    sendBotMessage(ctx.channel.id, {
                        content: `Enabled **${CATALOG_BY_ID.get(id)!.name}** on you (client only).`,
                    });
                    return;
                }

                if (sub === "disable") {
                    const id = (findOption(args[0].options, "id", "") as string).trim().toLowerCase();
                    setEnabledList(parseIdList(settings.store.enabledBadges).filter(x => x !== id));
                    sendBotMessage(ctx.channel.id, { content: `Disabled \`${id}\` on you.` });
                    return;
                }

                if (sub === "give") {
                    const userId = findOption(args[0].options, "user", "") as string;
                    const id = (findOption(args[0].options, "id", "") as string).trim().toLowerCase();
                    if (!CATALOG_BY_ID.has(id)) {
                        sendBotMessage(ctx.channel.id, { content: `Unknown badge \`${id}\`.` });
                        return;
                    }
                    const list = perUser[userId] ?? [];
                    if (!list.includes(id)) list.push(id);
                    perUser[userId] = list;
                    await savePerUser();
                    sendBotMessage(ctx.channel.id, {
                        content: `Showing **${CATALOG_BY_ID.get(id)!.name}** on <@${userId}> (only you see it).`,
                    });
                    return;
                }

                if (sub === "take") {
                    const userId = findOption(args[0].options, "user", "") as string;
                    const id = ((findOption(args[0].options, "id", "") as string) || "").trim().toLowerCase();
                    if (!id) {
                        delete perUser[userId];
                    } else {
                        perUser[userId] = (perUser[userId] ?? []).filter(x => x !== id);
                        if (!perUser[userId].length) delete perUser[userId];
                    }
                    await savePerUser();
                    sendBotMessage(ctx.channel.id, {
                        content: id
                            ? `Removed \`${id}\` from <@${userId}>.`
                            : `Cleared client badges on <@${userId}>.`,
                    });
                    return;
                }

                if (sub === "custom") {
                    const image = findOption(args[0].options, "image", "") as string;
                    const tooltip = findOption(args[0].options, "tooltip", "") as string;
                    const id = ((findOption(args[0].options, "id", "") as string) || `c${Date.now()}`).trim();
                    const list = parseCustom().filter(b => b.id !== id);
                    list.push({ id, iconSrc: image, description: tooltip });
                    setCustomList(list);
                    sendBotMessage(ctx.channel.id, {
                        content: `Added custom badge **${tooltip}** on you (client only).`,
                    });
                    return;
                }

                if (sub === "list") {
                    const self = parseIdList(settings.store.enabledBadges);
                    const custom = parseCustom();
                    const others = Object.entries(perUser)
                        .map(([uid, ids]) => `• <@${uid}>: ${ids.join(", ") || "(none)"}`)
                        .join("\n");

                    sendBotMessage(ctx.channel.id, {
                        content: [
                            "**Your catalog badges:** " + (self.join(", ") || "(none)"),
                            "**Custom:** " + (custom.map(b => b.description).join(", ") || "(none)"),
                            others ? `**On others:**\n${others}` : "**On others:** (none)",
                            "",
                            "**Catalog ids:**",
                            catalogIdsHelp(),
                        ].join("\n"),
                    });
                }
            },
        },
    ],
});
