const RAW = "https://cdn.jsdelivr.net/gh/PandaDevOfficial/badges-discord@main/assets";

export type BadgeCategory = "general" | "developer" | "nitro" | "boost";

export interface CatalogBadge {
    id: string;
    name: string;
    iconSrc: string;
    category: BadgeCategory;
}

export const CATEGORY_LABELS: Record<BadgeCategory, string> = {
    general: "Profile",
    developer: "Developer",
    nitro: "Nitro tenure",
    boost: "Server boosting",
};

export const CATEGORY_ORDER: BadgeCategory[] = ["general", "developer", "nitro", "boost"];

export const BADGE_CATALOG: CatalogBadge[] = [
    { id: "staff", name: "Discord Staff", category: "general", iconSrc: `${RAW}/discordstaff.svg` },
    { id: "partner", name: "Partnered Server Owner", category: "general", iconSrc: `${RAW}/discordpartner.svg` },
    { id: "hypesquad_events", name: "HypeSquad Events", category: "general", iconSrc: `${RAW}/hypesquadevents.svg` },
    { id: "hypesquad_bravery", name: "HypeSquad Bravery", category: "general", iconSrc: `${RAW}/hypesquadbravery.svg` },
    { id: "hypesquad_brilliance", name: "HypeSquad Brilliance", category: "general", iconSrc: `${RAW}/hypesquadbrilliance.svg` },
    { id: "hypesquad_balance", name: "HypeSquad Balance", category: "general", iconSrc: `${RAW}/hypesquadbalance.svg` },
    { id: "early_supporter", name: "Early Supporter", category: "general", iconSrc: `${RAW}/discordearlysupporter.svg` },
    { id: "nitro", name: "Discord Nitro", category: "general", iconSrc: `${RAW}/discordnitro.svg` },
    { id: "quest", name: "Completed a Quest", category: "general", iconSrc: `${RAW}/quest.png` },
    { id: "orb", name: "Orbs Apprentice", category: "general", iconSrc: `${RAW}/orb.svg` },

    { id: "active_developer", name: "Active Developer", category: "developer", iconSrc: `${RAW}/activedeveloper.svg` },
    { id: "early_bot_dev", name: "Early Verified Bot Developer", category: "developer", iconSrc: `${RAW}/discordbotdev.svg` },
    { id: "mod_alumni", name: "Moderator Programs Alumni", category: "developer", iconSrc: `${RAW}/discordmod.svg` },
    { id: "bug_hunter_1", name: "Bug Hunter", category: "developer", iconSrc: `${RAW}/discordbughunter1.svg` },
    { id: "bug_hunter_2", name: "Bug Hunter Gold", category: "developer", iconSrc: `${RAW}/discordbughunter2.svg` },

    { id: "nitro_bronze", name: "Nitro Bronze", category: "nitro", iconSrc: `${RAW}/subscriptions/badges/bronze.png` },
    { id: "nitro_silver", name: "Nitro Silver", category: "nitro", iconSrc: `${RAW}/subscriptions/badges/silver.png` },
    { id: "nitro_gold", name: "Nitro Gold", category: "nitro", iconSrc: `${RAW}/subscriptions/badges/gold.png` },
    { id: "nitro_platinum", name: "Nitro Platinum", category: "nitro", iconSrc: `${RAW}/subscriptions/badges/platinum.png` },
    { id: "nitro_diamond", name: "Nitro Diamond", category: "nitro", iconSrc: `${RAW}/subscriptions/badges/diamond.png` },
    { id: "nitro_emerald", name: "Nitro Emerald", category: "nitro", iconSrc: `${RAW}/subscriptions/badges/emerald.png` },
    { id: "nitro_ruby", name: "Nitro Ruby", category: "nitro", iconSrc: `${RAW}/subscriptions/badges/ruby.png` },
    { id: "nitro_opal", name: "Nitro Opal", category: "nitro", iconSrc: `${RAW}/subscriptions/badges/opal.png` },

    { id: "boost_1", name: "Boost 1 month", category: "boost", iconSrc: `${RAW}/boosts/discordboost1.svg` },
    { id: "boost_2", name: "Boost 2 months", category: "boost", iconSrc: `${RAW}/boosts/discordboost2.svg` },
    { id: "boost_3", name: "Boost 3 months", category: "boost", iconSrc: `${RAW}/boosts/discordboost3.svg` },
    { id: "boost_4", name: "Boost 6 months", category: "boost", iconSrc: `${RAW}/boosts/discordboost4.svg` },
    { id: "boost_5", name: "Boost 9 months", category: "boost", iconSrc: `${RAW}/boosts/discordboost5.svg` },
    { id: "boost_6", name: "Boost 12 months", category: "boost", iconSrc: `${RAW}/boosts/discordboost6.svg` },
    { id: "boost_7", name: "Boost 15 months", category: "boost", iconSrc: `${RAW}/boosts/discordboost7.svg` },
    { id: "boost_8", name: "Boost 18 months", category: "boost", iconSrc: `${RAW}/boosts/discordboost8.svg` },
    { id: "boost_9", name: "Boost 24 months", category: "boost", iconSrc: `${RAW}/boosts/discordboost9.svg` },
];

export const CATALOG_BY_ID = new Map(BADGE_CATALOG.map(b => [b.id, b]));

export function catalogIdsHelp(): string {
    return BADGE_CATALOG.map(b => `\`${b.id}\` (${b.name})`).join("\n");
}
