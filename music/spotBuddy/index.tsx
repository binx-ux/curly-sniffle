/*
 * Vencord, a Discord client mod
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import { definePluginSettings } from "@api/Settings";
import ErrorBoundary from "@components/ErrorBoundary";
import { classNameFactory } from "@utils/css";
import { sendMessage } from "@utils/discord";
import definePlugin, { OptionType, PluginNative } from "@utils/types";
import { findByPropsLazy } from "@webpack";
import {
    Button,
    createRoot,
    FluxDispatcher,
    PresenceStore,
    RelationshipStore,
    SelectedChannelStore,
    useEffect,
    useRef,
    UserStore,
    useState,
} from "@webpack/common";

const Native = VencordNative.pluginHelpers.SpotBuddy as PluginNative<typeof import("./native")>;

const cl = classNameFactory("vc-spotBuddy-");
const SpotifyApi = findByPropsLazy("getPlayerState", "getTrack");

const settings = definePluginSettings({
    showLyrics: {
        type: OptionType.BOOLEAN,
        description: "Show lyrics",
        default: true,
    },
    showShareButton: {
        type: OptionType.BOOLEAN,
        description: "Show share button",
        default: true,
    },
    syncOffsetMs: {
        type: OptionType.NUMBER,
        description: "Lyric offset in ms (negative = earlier)",
        default: 0,
    },
    fancyLyrics: {
        type: OptionType.BOOLEAN,
        description: "Fancy lyric animation",
        default: true,
    },
});

type TrackInfo = {
    id: string | null;
    title: string;
    artists: string;
    album: string;
    art: string | null;
    duration: number;
    position: number;
    playing: boolean;
    url: string | null;
};

type Line = { t: number; text: string; };

let fluxTrack: any = null;
let posBase = 0;
let posAt = 0;
let playing = false;
let lastApiPos = -1;
const subs = new Set<() => void>();

function ping() {
    for (const fn of subs) fn();
}

function onSpotify(e: any) {
    if (e?.track) fluxTrack = e.track;
    if (typeof e?.isPlaying === "boolean") playing = e.isPlaying;
    if (typeof e?.position === "number") {
        posBase = e.position;
        posAt = Date.now();
        lastApiPos = e.position;
    }
    ping();
}

function posNow() {
    let p = posBase;
    if (playing) p += Date.now() - posAt;
    return Math.max(0, p);
}

function pullApiClock(state: any) {
    if (typeof state?.isPlaying === "boolean") playing = state.isPlaying;
    if (typeof state?.position !== "number") return;
    if (state.position === lastApiPos) return;
    lastApiPos = state.position;
    posBase = state.position;
    posAt = Date.now();
}

function fmt(ms: number) {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}

function artUrl(raw?: string) {
    if (!raw) return null;
    if (raw.includes("https://")) return raw;
    const id = raw.split(":").pop();
    return id ? `https://i.scdn.co/image/${id}` : null;
}

function fromTrack(t: any, position: number, isPlaying: boolean): TrackInfo | null {
    if (!t?.name) return null;
    const id = t.id ?? null;
    const artists = Array.isArray(t.artists)
        ? t.artists.map((a: any) => a.name).filter(Boolean).join(", ")
        : "";
    return {
        id,
        title: t.name,
        artists,
        album: t.album?.name ?? "",
        art: t.album?.image?.url ?? null,
        duration: t.duration ?? 0,
        position,
        playing: isPlaying,
        url: id ? `https://open.spotify.com/track/${id}` : null,
    };
}

function readSpotifyApi(): TrackInfo | null {
    try {
        const state = SpotifyApi.getPlayerState?.();
        const t = SpotifyApi.getTrack?.() ?? state?.track ?? fluxTrack;
        if (!t) return null;
        pullApiClock(state);
        return fromTrack(t, posNow(), playing);
    } catch {
        return fromTrack(fluxTrack, posNow(), playing);
    }
}

function presenceTrack(userId: string): TrackInfo | null {
    try {
        const list = PresenceStore.getActivities(userId) ?? [];
        const a = list.find((x: any) =>
            x?.name === "Spotify"
            || x?.sync_id
            || (typeof x?.party?.id === "string" && x.party.id.includes("spotify"))
        );
        if (!a?.details) return null;

        const start = a.timestamps?.start ? Number(a.timestamps.start) : 0;
        const end = a.timestamps?.end ? Number(a.timestamps.end) : 0;
        const duration = start && end ? end - start : 0;
        let position = start ? Date.now() - start : 0;
        if (duration > 0) position = Math.min(Math.max(0, position), duration);
        const id = a.sync_id ?? null;

        return {
            id,
            title: a.details,
            artists: a.state ?? "",
            album: a.assets?.large_text ?? "",
            art: artUrl(a.assets?.large_image),
            duration,
            position,
            playing: true,
            url: id ? `https://open.spotify.com/track/${id}` : null,
        };
    } catch {
        return null;
    }
}

function trackFor(userId: string) {
    const me = UserStore.getCurrentUser()?.id;
    if (userId === me) return readSpotifyApi() ?? presenceTrack(userId);
    return presenceTrack(userId);
}

function userIdForTrack(trackId: string | null) {
    const me = UserStore.getCurrentUser()?.id;
    if (!trackId) return me ?? null;
    if (me) {
        const acts = PresenceStore.getActivities(me) ?? [];
        if (acts.some((a: any) => a?.sync_id === trackId)) return me;
    }
    try {
        const ids = RelationshipStore.getFriendIDs?.() ?? [];
        for (const id of ids) {
            const acts = PresenceStore.getActivities(id) ?? [];
            if (acts.some((a: any) => a?.sync_id === trackId)) return id;
        }
    } catch { }
    return me ?? null;
}

const lyricCache = new Map<string, { lines: Line[]; instrumental: boolean; } | null>();

function cleanTitle(t: string) {
    return t
        .replace(/\u2026/g, "...")
        .replace(/\.\.\.$/, "")
        .replace(/\s*\((?:feat\.?|ft\.?|with|featuring).*$/i, "")
        .replace(/\s*\[(?:feat\.?|ft\.?|with|featuring).*$/i, "")
        .replace(/\s+feat\.?\s+.*$/i, "")
        .trim();
}

function cleanArtist(a: string) {
    return a.split(/,|&|\sx\s/i)[0]?.trim() || a.trim();
}

function parseLrc(raw: string): Line[] {
    const out: Line[] = [];
    for (const line of raw.split("\n")) {
        const m = line.match(/^\[(\d+):(\d+(?:\.\d+)?)\]\s*(.*)$/);
        if (!m) continue;
        const text = m[3].trim();
        if (!text) continue;
        out.push({ t: Number(m[1]) * 60 + Number(m[2]), text });
    }
    return out;
}

function fromLrcData(data: any) {
    if (!data) return null;
    if (data.instrumental) return { lines: [] as Line[], instrumental: true };
    if (data.syncedLyrics) return { lines: parseLrc(data.syncedLyrics), instrumental: false };
    if (data.plainLyrics) {
        const lines = String(data.plainLyrics).split("\n").map(x => x.trim()).filter(Boolean)
            .map((text, i) => ({ t: i * 4, text }));
        return { lines, instrumental: false };
    }
    return null;
}

async function getJson(url: string) {
    if (Native?.fetchText) {
        const r = await Native.fetchText(url);
        if (!r.ok || !r.text) return null;
        try {
            return JSON.parse(r.text);
        } catch {
            return null;
        }
    }

    const res = await fetch(url);
    if (!res.ok) return null;
    return res.json();
}

async function getLyrics(artist: string, title: string, _album: string, _duration: number) {
    const a = cleanArtist(artist);
    const t = cleanTitle(title);
    if (!t) return null;

    const key = `${a}|${t}`.toLowerCase();
    if (lyricCache.has(key)) return lyricCache.get(key)!;

    try {
        const tries = [
            "https://lrclib.net/api/search?" + new URLSearchParams({ track_name: t, artist_name: a }),
            "https://lrclib.net/api/search?" + new URLSearchParams({ q: `${a} ${t}` }),
            "https://lrclib.net/api/get?" + new URLSearchParams({ track_name: t, artist_name: a }),
        ];

        for (const url of tries) {
            const json = await getJson(url);
            if (!json) continue;

            if (Array.isArray(json)) {
                const hit = json.find((h: any) => h.syncedLyrics)
                    || json.find((h: any) => h.plainLyrics)
                    || json[0];
                const parsed = fromLrcData(hit);
                if (parsed) {
                    lyricCache.set(key, parsed);
                    return parsed;
                }
            } else {
                const parsed = fromLrcData(json);
                if (parsed) {
                    lyricCache.set(key, parsed);
                    return parsed;
                }
            }
        }
    } catch (e) {
        console.error("[SpotBuddy] lyrics fetch failed", e);
        return null;
    }

    lyricCache.set(key, null);
    return null;
}

function currentLine(lines: Line[], sec: number) {
    let idx = 0;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].t <= sec) idx = i;
        else break;
    }
    return idx;
}

function lineProgress(lines: Line[], i: number, sec: number) {
    const start = lines[i]?.t ?? 0;
    const end = lines[i + 1]?.t ?? start + 4;
    const span = Math.max(0.08, end - start);
    return Math.min(1, Math.max(0, (sec - start) / span));
}

const LINE_H = 30;

function FancyLyrics({ lines, getSec }: { lines: Line[]; getSec: () => number; }) {
    const [i, setI] = useState(() => currentLine(lines, getSec()));
    const iRef = useRef(i);
    const litRef = useRef<HTMLSpanElement>(null);

    useEffect(() => {
        iRef.current = -1;
        let raf = 0;
        const tick = () => {
            const sec = getSec();
            const idx = currentLine(lines, sec);
            const lit = litRef.current;
            if (lit) lit.style.width = `${lineProgress(lines, idx, sec) * 100}%`;
            if (idx !== iRef.current) {
                iRef.current = idx;
                setI(idx);
            }
            raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [lines, getSec]);

    return (
        <div className={cl("lyrics", "fancy")}>
            {[-2, -1, 0, 1, 2].map(d => {
                const n = i + d;
                const text = n >= 0 && n < lines.length ? (lines[n].text || "\u00a0") : "\u00a0";
                let kind = "near";
                if (d === 0) kind = "cur";
                else if (d === -1) kind = "prev";
                else if (d === 1) kind = "next";
                else if (Math.abs(d) >= 2) kind = "far";

                if (d === 0) {
                    return (
                        <div key="cur" className={cl("line", "cur")} style={{ height: LINE_H }}>
                            <span className={cl("karaoke")}>
                                <span className={cl("karaoke-dim")}>{text}</span>
                                <span className={cl("karaoke-lit")} ref={litRef}>
                                    <span className={cl("karaoke-lit-inner")}>{text}</span>
                                </span>
                            </span>
                        </div>
                    );
                }

                return (
                    <div key={d} className={cl("line", kind)} style={{ height: LINE_H }}>
                        {text}
                    </div>
                );
            })}
        </div>
    );
}

function PlainLyrics({ lines, getSec }: { lines: Line[]; getSec: () => number; }) {
    const [i, setI] = useState(() => currentLine(lines, getSec()));

    useEffect(() => {
        let raf = 0;
        let last = -1;
        const tick = () => {
            const idx = currentLine(lines, getSec());
            if (idx !== last) {
                last = idx;
                setI(idx);
            }
            raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [lines, getSec]);

    return (
        <div className={cl("lyrics")}>
            <div className={cl("line", "prev")}>{i > 0 ? lines[i - 1].text : "\u00a0"}</div>
            <div className={cl("line", "cur")}>{lines[i]?.text || "\u00a0"}</div>
            <div className={cl("line", "next")}>{lines[i + 1]?.text || "\u00a0"}</div>
        </div>
    );
}

function Panel({ userId }: { userId: string; }) {
    const [, setN] = useState(0);
    const [lyrics, setLyrics] = useState<{ lines: Line[]; instrumental: boolean; } | null | undefined>();
    const offsetRef = useRef(settings.store.syncOffsetMs || 0);
    offsetRef.current = settings.store.syncOffsetMs || 0;

    const getSec = useRef(() => {
        const t = trackFor(userId);
        return Math.max(0, (t?.position ?? 0) + offsetRef.current) / 1000;
    });
    getSec.current = () => {
        const t = trackFor(userId);
        return Math.max(0, (t?.position ?? 0) + offsetRef.current) / 1000;
    };
    const readSec = useRef(() => getSec.current()).current;

    useEffect(() => {
        const fn = () => setN(n => n + 1);
        subs.add(fn);
        const iv = setInterval(fn, 500);
        return () => {
            subs.delete(fn);
            clearInterval(iv);
        };
    }, []);

    const info = trackFor(userId);

    useEffect(() => {
        let dead = false;
        setLyrics(undefined);
        if (!info || !settings.store.showLyrics) {
            setLyrics(null);
            return;
        }
        const artist = info.artists.split(",")[0]?.trim() || info.artists;
        getLyrics(artist, info.title, info.album, info.duration).then(r => {
            if (!dead) setLyrics(r);
        });
        return () => { dead = true; };
    }, [info?.id, info?.title, info?.artists, info?.album, info?.duration]);

    if (!info) {
        return (
            <div className={cl("card")}>
                <div className={cl("title")}>SpotBuddy</div>
                <div className={cl("sub")}>waiting for spotify...</div>
            </div>
        );
    }

    const pos = Math.max(0, info.position + offsetRef.current);
    const pct = info.duration > 0 ? Math.min(100, (pos / info.duration) * 100) : 0;

    let lyricEl: any = null;
    if (settings.store.showLyrics) {
        if (lyrics === undefined) lyricEl = <div className={cl("muted")}>loading lyrics...</div>;
        else if (!lyrics) lyricEl = <div className={cl("muted")}>no lyrics found</div>;
        else if (lyrics.instrumental) lyricEl = <div className={cl("muted")}>instrumental</div>;
        else if (!lyrics.lines.length) lyricEl = <div className={cl("muted")}>no lyrics found</div>;
        else if (settings.store.fancyLyrics) {
            lyricEl = <FancyLyrics lines={lyrics.lines} getSec={readSec} />;
        } else {
            lyricEl = <PlainLyrics lines={lyrics.lines} getSec={readSec} />;
        }
    }

    return (
        <div className={cl("card")}>
            <div className={cl("row")}>
                {info.art && <img className={cl("art")} src={info.art} alt="" draggable={false} />}
                <div className={cl("meta")}>
                    <div className={cl("title")}>{info.title}</div>
                    {info.artists && <div className={cl("sub")}>{info.artists}</div>}
                    {info.album && <div className={cl("sub")}>{info.album}</div>}
                    {info.duration > 0 && (
                        <div className={cl("sub")}>
                            {fmt(pos)} / {fmt(info.duration)}{info.playing ? "" : " (paused)"}
                        </div>
                    )}
                </div>
            </div>

            {info.duration > 0 && (
                <div className={cl("bar")}>
                    <div className={cl("fill")} style={{ width: pct + "%" }} />
                </div>
            )}

            {lyricEl}

            {settings.store.showShareButton && info.url && (
                <div className={cl("actions")}>
                    <Button
                        size="small"
                        look={Button.Looks.OUTLINED}
                        onClick={() => {
                            const ch = SelectedChannelStore.getChannelId();
                            if (!ch) return;
                            sendMessage(ch, {
                                content: `**${info.title}**` + (info.artists ? ` by ${info.artists}` : "") + ` ${info.url}`,
                            });
                        }}
                    >
                        Share
                    </Button>
                    <Button
                        size="small"
                        look={Button.Looks.LINK}
                        onClick={() => VencordNative.native.openExternal(info.url!)}
                    >
                        Open
                    </Button>
                </div>
            )}
        </div>
    );
}

const SafePanel = ErrorBoundary.wrap(Panel, { noop: true });

type Mount = { root: ReturnType<typeof createRoot>; host: HTMLElement; };
const mounts = new Map<Element, Mount>();

function spotifyCardFromEl(start: HTMLElement) {
    let el: HTMLElement | null = start;
    for (let i = 0; i < 10 && el; i++) {
        const rect = el.getBoundingClientRect();
        if (rect.width > 180 && rect.height > 48 && rect.height < 280) {
            const txt = el.textContent || "";
            if (/spotify/i.test(txt) || el.querySelector?.('a[href*="spotify"]'))
                return el;
        }
        el = el.parentElement;
    }
    return start;
}

function findSpotifyCards(): HTMLElement[] {
    const out: HTMLElement[] = [];
    const seen = new Set<HTMLElement>();

    const add = (el: HTMLElement | null | undefined) => {
        if (!el || seen.has(el)) return;
        const card = spotifyCardFromEl(el);
        if (!card || seen.has(card)) return;
        seen.add(card);
        out.push(card);
    };

    document.querySelectorAll('a[href*="open.spotify.com"], a[href^="spotify:"]').forEach(a => {
        add(a as HTMLElement);
    });

    const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node: Node | null;
    while ((node = walk.nextNode())) {
        const t = node.textContent || "";
        if (!/listening to spotify/i.test(t)) continue;
        add(node.parentElement);
    }

    return out;
}

function scan() {
    const cards = findSpotifyCards();
    const alive = new Set<Element>();

    for (const card of cards) {
        if (card.closest(".vc-spotBuddy-host")) continue;
        if (mounts.has(card)) {
            alive.add(card);
            continue;
        }

        let trackId: string | null = null;
        const link = card.querySelector('a[href*="track/"]') as HTMLAnchorElement | null;
        if (link?.href) {
            trackId = link.href.match(/track[/:]([a-zA-Z0-9]+)/)?.[1] ?? null;
        }
        const userId = userIdForTrack(trackId) ?? UserStore.getCurrentUser()?.id;
        if (!userId) continue;

        const host = document.createElement("div");
        host.className = "vc-spotBuddy-host";
        card.insertAdjacentElement("afterend", host);

        const root = createRoot(host);
        root.render(<SafePanel userId={userId} />);
        mounts.set(card, { root, host });
        alive.add(card);
    }

    for (const [card, mount] of mounts) {
        if (!document.contains(card) || !alive.has(card)) {
            mount.root.unmount();
            mount.host.remove();
            mounts.delete(card);
        }
    }
}

let obs: MutationObserver | null = null;
let scanTimer: any;

function queueScan() {
    clearTimeout(scanTimer);
    scanTimer = setTimeout(scan, 200);
}

export default definePlugin({
    name: "SpotBuddy",
    description: "Spotify lyrics under the listening card on profiles",
    authors: [{ name: "kyn", id: 839321627938390047n }],
    settings,

    start() {
        FluxDispatcher.subscribe("SPOTIFY_PLAYER_STATE", onSpotify);
        FluxDispatcher.subscribe("PRESENCE_UPDATES", ping);
        obs = new MutationObserver(queueScan);
        obs.observe(document.body, { childList: true, subtree: true });
        queueScan();
    },

    stop() {
        FluxDispatcher.unsubscribe("SPOTIFY_PLAYER_STATE", onSpotify);
        FluxDispatcher.unsubscribe("PRESENCE_UPDATES", ping);
        obs?.disconnect();
        obs = null;
        clearTimeout(scanTimer);
        for (const [, mount] of mounts) {
            mount.root.unmount();
            mount.host.remove();
        }
        mounts.clear();
    },
});
