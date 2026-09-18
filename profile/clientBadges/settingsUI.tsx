import { classNameFactory } from "@utils/css";
import {
    Button,
    React,
    TextInput,
    Tooltip,
    useState,
} from "@webpack/common";

import {
    BADGE_CATALOG,
    CATEGORY_LABELS,
    CATEGORY_ORDER,
} from "./catalog";
import { parseCustom, parseIdList, setCustomList, setEnabledList, settings } from "./store";

const cl = classNameFactory("vc-clientBadges-");

function CatalogPicker() {
    const { enabledBadges } = settings.use(["enabledBadges"]);
    const enabled = new Set(parseIdList(enabledBadges));

    function toggle(id: string) {
        const next = new Set(enabled);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setEnabledList([...next]);
    }

    return (
        <div className={cl("section")}>
            <p className={cl("hint")}>
                Click a badge to show it on your profile. Only you can see these.
            </p>
            <p className={cl("count")}>
                {enabled.size} selected
            </p>
            {CATEGORY_ORDER.map(cat => {
                const items = BADGE_CATALOG.filter(b => b.category === cat);
                return (
                    <div key={cat} className={cl("section")}>
                        <h3 className={cl("heading")}>{CATEGORY_LABELS[cat]}</h3>
                        <div className={cl("grid")}>
                            {items.map(b => {
                                const on = enabled.has(b.id);
                                return (
                                    <Tooltip key={b.id} text={b.name}>
                                        {props => (
                                            <button
                                                {...props}
                                                type="button"
                                                className={cl("tile", { on })}
                                                onClick={() => toggle(b.id)}
                                                aria-pressed={on}
                                            >
                                                <img
                                                    className={cl("tileImg")}
                                                    src={b.iconSrc}
                                                    alt=""
                                                    draggable={false}
                                                />
                                                <span className={cl("tileName")}>{b.name}</span>
                                            </button>
                                        )}
                                    </Tooltip>
                                );
                            })}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function CustomBadgesEditor() {
    const { customBadges } = settings.use(["customBadges"]);
    const list = parseCustom(customBadges);
    const [image, setImage] = useState("");
    const [tooltip, setTooltip] = useState("");

    function add() {
        const iconSrc = image.trim();
        const description = tooltip.trim();
        if (!iconSrc || !description) return;
        const id = `c${Date.now()}`;
        setCustomList([...list, { id, iconSrc, description }]);
        setImage("");
        setTooltip("");
    }

    function remove(id: string) {
        setCustomList(list.filter(b => b.id !== id));
    }

    return (
        <div className={cl("section")}>
            <h3 className={cl("heading")}>Custom badges</h3>
            <div className={cl("form")}>
                <TextInput
                    placeholder="Image URL"
                    value={image}
                    onChange={setImage}
                />
                <div className={cl("formRow")}>
                    <TextInput
                        placeholder="Hover text"
                        value={tooltip}
                        onChange={setTooltip}
                    />
                    <Button
                        size="medium"
                        onClick={add}
                        disabled={!image.trim() || !tooltip.trim()}
                    >
                        Add
                    </Button>
                </div>
            </div>

            {list.length === 0 ? (
                <div className={cl("empty")}>No custom badges yet.</div>
            ) : (
                <div className={cl("customList")}>
                    {list.map(b => (
                        <div key={b.id} className={cl("customRow")}>
                            <img src={b.iconSrc} alt="" draggable={false} />
                            <div className={cl("customMeta")}>
                                <strong>{b.description}</strong>
                                <span>{b.iconSrc}</span>
                            </div>
                            <Button
                                size="small"
                                look={Button.Looks.LINK}
                                color={Button.Colors.RED}
                                onClick={() => remove(b.id)}
                            >
                                Remove
                            </Button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export function BadgeSettings() {
    return (
        <div className={cl("root")}>
            <CatalogPicker />
            <CustomBadgesEditor />
        </div>
    );
}
