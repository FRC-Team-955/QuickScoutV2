import {Fragment, useEffect, useRef, useState} from "react";
import {useNavigate} from "react-router-dom";
import {useTranslation} from "react-i18next";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/Topbar";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Textarea} from "@/components/ui/textarea";
import {Card, CardContent, CardDescription, CardHeader, CardTitle,} from "@/components/ui/card";
import {Label} from "@/components/ui/label";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue,} from "@/components/ui/select";
import {useAuth} from "@/contexts/AuthContext";
import {Play, X} from "lucide-react";
import {toast} from "sonner";
import {get, ref, serverTimestamp, set} from "firebase/database";
import {db} from "@/lib/firebase";
import {TBA_EVENT_KEY, getEventTeams} from "@/lib/tba.ts";
import {buildPitPayload, getScoutedTeams, PitScoutingResponse, removeAutoResponses} from "@/lib/pitScouting";

interface PitScoutingQuestion {
    id: string;
    label: string;
    section: string;
    name?: string; //used for buttons and multi-buttons
    // button-group stores `name` under responses[parent]; button-group-multi stores a string[] there
    type: "text" | "textarea" | "label" | "button-group" | "button-group-multi";
    required?: boolean;
    placeholder?: string;
    parent?: string | null;
}

const label = (id: string, label: string, section: string): PitScoutingQuestion => ({id, label, section, type: "label"});
const text = (id: string, label: string, section: string, placeholder = "", type: "text" | "textarea" = "text", parent: string = null): PitScoutingQuestion =>
    ({id, label, section, type, placeholder, parent});
const buttons = (section: string, parent: string, type: "button-group" | "button-group-multi", opts: [string, string][]): PitScoutingQuestion[] =>
    opts.map(([id, name]) => ({id, name, section, type, parent, label: ""}));

const RC = "Robot Capabilities";
const STRATEGY = "Strategy & Notes";

const PIT_SCOUTING_QUESTIONS: PitScoutingQuestion[] = [
    label("climb-level", "Climb", RC),
    ...buttons(RC, "Climb", "button-group", [["climb-level-l1", "L1"], ["climb-level-l2", "L2"], ["climb-level-l3", "L3"], ["climb-level-none", "Nah"]]),

    label("size-constraints", "Size Constraints", RC),
    ...buttons(RC, "Size Constraints", "button-group-multi", [["under-trench-height", "Under Trench height (22.25\")"], ["over-bump", "Over the Bump"]]),

    label("shooting-capabilities", "Shooting Capabilities", RC),
    ...buttons(RC, "Shooting Capabilities", "button-group-multi", [["shoot-on-move", "Shoot on the Move"], ["pass-fuel", "Pass Fuel to Alliance Zone"]]),

    label("defense-rating", "Defense rating (1-5):", RC),
    ...buttons(RC, "Defense rating (1-5):", "button-group", ["1", "2", "3", "4", "5"].map((n): [string, string] => [`defense-rating-${n}`, n])),

    text("fuel-hopper", "Approximate max fuel in hopper:", RC),
    text("shooter-type", "Shooter type:", RC, "eg., turret, drum shooter, hooded, fixed"),
    text("bps", "BPS (balls per sec):", RC),

    label("modify-autos", "How easily can they modify autos (on the spot)?", "Auto Capabilities"),
    ...buttons(RC, "How easily can they modify autos (on the spot)?", "button-group", [
        ["modify-autos-cannot", "Can't change at comp"], ["modify-autos-hard", "Hard to change"],
        ["modify-autos-medium", "Medium"], ["modify-autos-easy", "Easy to change"],
    ]),

    // Everything in "Autos" is rendered once per auto card, keyed auto_{index}_{id}
    text("auto-description", "Auto Description", "Autos", "This auto does..."),
    label("starting-locations", "Starting Location", "Autos"),
    ...buttons("Autos", "Starting Location", "button-group", [
        ["starting-locations-center", "Center (in front of hub)"], ["starting-locations-left-trench", "Left Trench"],
        ["starting-locations-right-trench", "Right Trench"], ["starting-locations-left-bump", "Left Bump"],
        ["starting-locations-right-bump", "Right Bump"], ["starting-locations-other", "Other"],
    ]),
    text("starting-locations-other-text", "", "Autos", "Other starting location:", "text", "Starting Location"),
    text("auto-locations", "Cycle Path", "Autos",
        "eg., start left trench, cycle neutral through left trench, back to alliance through left bump, repeat, stop at left side hub.", "textarea"),

    label("fuel-scoring", "Preloaded Fuel", "Autos"),
    ...buttons("Autos", "Preloaded Fuel", "button-group", [
        ["score-preloads", "Shoot"], ["no-shoot-preloads-neutral-zone", "No shoot (races to neutral zone)"],
        ["no-shoot-preloads-cant-shoot", "No shoot (can't shoot)"],
    ]),
    text("estimated-fuel", "Estimated Fuel Scored:", "Autos"),
    label("auto-climb", "Climb", "Autos"), // shares the "Climb" children with Robot Capabilities

    text("robot-strengths", "Robot Strengths", STRATEGY, "What are the main strengths of this robot?", "textarea"),
    text("robot-weaknesses", "Robot Weaknesses", STRATEGY, "What are the main weaknesses of this robot?", "textarea"),
    text("notable-features", "Notable Features", STRATEGY, "Any unique mechanisms or features?", "textarea"),
    text("driver-experience", "Driver Experience", STRATEGY, "Experience of the driveteam(s)", "textarea"),
    text("additional-notes", "Additional Notes", STRATEGY, "Any other observations from pit scouting?", "textarea"),
];

const groupedQuestions = PIT_SCOUTING_QUESTIONS.reduce((acc, q) => {
    (acc[q.section] ??= []).push(q);
    return acc;
}, {} as Record<string, PitScoutingQuestion[]>);

const getChildQuestions = (parentLabel: string) => PIT_SCOUTING_QUESTIONS.filter(q => q.parent === parentLabel);

const TABS = new Set(["dashboard", "scouting", "pit-scouting", "analytics", "matches", "opr", "leaderboard"]);

const getTranslationKey = (label: string): string => {
    const labelToKeyMap: Record<string, string> = {
        "Climb": "climb",
        "L1": "climbL1",
        "L2": "climbL2",
        "L3": "climbL3",
        "Nah": "climbNone",
        "Size Constraints": "sizeConstraints",
        "Under Trench height (22.25\")": "underTrenchHeight",
        "Over the Bump": "overBump",
        "Shooting Capabilities": "shootingCapabilities",
        "Shoot on the Move": "shootOnMove",
        "Pass Fuel to Alliance Zone": "passFuel",
        "Defense rating (1-5):": "defenseRating",
        "1": "defenseRating1",
        "2": "defenseRating2",
        "3": "defenseRating3",
        "4": "defenseRating4",
        "5": "defenseRating5",
        "Approximate max fuel in hopper:": "approxMaxFuel",
        "Shooter type:": "shooterType",
        "BPS (balls per sec):": "bps",
        "How easily can they modify autos (on the spot)?": "modifyAutos",
        "Can't change at comp": "cantChangeAtComp",
        "Hard to change": "hardToChange",
        "Medium": "medium",
        "Easy to change": "easyToChange",
        "Auto Description": "autoDescription",
        "Starting Location": "startingLocation",
        "Center (in front of hub)": "centerHub",
        "Left Trench": "leftTrench",
        "Right Trench": "rightTrench",
        "Left Bump": "leftBump",
        "Right Bump": "rightBump",
        "Other": "other",
        "Other starting location:": "otherStartingLocation",
        "Cycle Path": "cyclePath",
        "Preloaded Fuel": "preloadedFuel",
        "Shoot": "shoot",
        "No shoot (races to neutral zone)": "noShootNeutralZone",
        "No shoot (can't shoot)": "noShootCantShoot",
        "Estimated Fuel Scored:": "estimatedFuel",
        "Robot Strengths": "robotStrengths",
        "Robot Weaknesses": "robotWeaknesses",
        "Notable Features": "notableFeatures",
        "Driver Experience": "driverExperience",
        "Additional Notes": "additionalNotes",
        "Robot Capabilities": "robotCapabilities",
        "Auto Capabilities": "autoCapabilities",
        "Autos": "autos",
        "Strategy & Notes": "strategyNotes",
    };
    return labelToKeyMap[label] || label;
};

const PitScouting = () => {
    const {user} = useAuth();
    const navigate = useNavigate();
    const {t, i18n} = useTranslation();
    const [activeTab, setActiveTab] = useState("pit-scouting");
    const [language, setLanguage] = useState(i18n.language);
    const [unscoutedTeams, setUnscoutedTeams] = useState<number[]>([]);
    const [responses, setResponses] = useState<PitScoutingResponse>({});
    const [isActive, setIsActive] = useState(false);
    const [teamNumber, setTeamNumber] = useState("");
    const [cancelConfirm, setCancelConfirm] = useState(false);
    const cancelTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const [autoCount, setAutoCount] = useState(0);

    useEffect(() => {
        const initData = async () => {
            try {
                const teamKeys: string[] = await getEventTeams(TBA_EVENT_KEY);
                const pitSnap = await get(ref(db, "pitScouting"));
                const scouted = getScoutedTeams(pitSnap.val());
                setUnscoutedTeams(teamKeys
                    .map(key => parseInt(key.replace("frc", ""), 10))
                    .filter(n => !scouted.has(n))
                    .sort((a, b) => a - b));
            } catch (err) {
                console.error("Failed to load unscouted teams:", err);
            }
        };
        initData();
    }, []);

    const handleTabChange = (tab: string) => {
        setActiveTab(tab);
        if (TABS.has(tab)) navigate(`/${tab}`);
    };

    const handleLanguageChange = (lang: string) => {
        setLanguage(lang);
        i18n.changeLanguage(lang);
    };

    // Clears every per-team field, including the auto cards (they used to survive into the next team)
    const resetForm = (team = "", active = false) => {
        setTeamNumber(team);
        setIsActive(active);
        setResponses({});
        setAutoCount(0);
        setCancelConfirm(false);
    };

    const handleStartScouting = (teamNum?: string) => {
        const digits = (teamNum ?? teamNumber).replace(/[^0-9]/g, "");
        if (!digits) {
            toast("Please enter a valid team number");
            return;
        }
        // Normalize "0955" -> "955" so the RTDB path matches the stored numeric teamNumber
        resetForm(String(parseInt(digits, 10)), true);
    };

    const handleResponseChange = (questionId: string, value: string | string[]) => {
        setResponses((prev) => ({...prev, [questionId]: value}));
    };

    const removeAuto = (index: number) => {
        setResponses((prev) => removeAutoResponses(prev, index));
        setAutoCount((prev) => prev - 1);
    };

    const handleSubmit = async () => {
        if (!user?.id) {
            toast("You must be logged in to submit pit scouting data");
            return;
        }

        const missingRequired = PIT_SCOUTING_QUESTIONS.filter((q) => q.required && !responses[q.id]);
        if (missingRequired.length > 0) {
            toast(`Please answer all required questions: ${missingRequired.map((q) => q.label).join(", ")}`);
            return;
        }

        try {
            const dateStr = new Date().toISOString().split("T")[0]; // YYYY-MM-DD (UTC)
            await set(
                ref(db, `pitScouting/${dateStr}/${teamNumber}/${user.id}`),
                buildPitPayload(responses, teamNumber, user, serverTimestamp()),
            );
            toast("Pit scouting data submitted successfully!");
            setUnscoutedTeams((prev) => prev.filter((n) => n !== parseInt(teamNumber, 10)));
            resetForm();
        } catch (err) {
            console.error("Failed to submit pit scouting data:", err);
            toast("Failed to save pit scouting data. Please try again.");
        }
    };

    const handleCancelClick = () => {
        if (cancelTimeoutRef.current) clearTimeout(cancelTimeoutRef.current);
        cancelTimeoutRef.current = null;
        if (!cancelConfirm) {
            setCancelConfirm(true);
            cancelTimeoutRef.current = setTimeout(() => setCancelConfirm(false), 3000);
        } else {
            resetForm();
        }
    };

    const renderQuestion = (question: PitScoutingQuestion) => {
        const value = responses[question.id];

        switch (question.type) {
            case "text":
            case "textarea": {
                const Field = question.type === "text" ? Input : Textarea;
                return (
                    <Field
                        placeholder={question.placeholder}
                        value={(value as string) || ""}
                        onChange={(e) => handleResponseChange(question.id, e.target.value)}
                        disabled={!isActive}
                        className={question.type === "textarea" ? "min-h-[100px]" : undefined}
                    />
                );
            }
            case "button-group":
            case "button-group-multi": {
                const current = responses[question.parent!];
                const selected = question.type === "button-group" ? current === question.name : Array.isArray(current) && current.includes(question.name!);
                const onClick = () => {
                    if (question.type === "button-group") return handleResponseChange(question.parent!, question.name!);
                    const list = Array.isArray(current) ? current : [];
                    handleResponseChange(question.parent!, selected ? list.filter(v => v !== question.name) : [...list, question.name!]);
                };
                return (
                    <Button variant={selected ? "default" : "outline"} onClick={onClick} disabled={!isActive} className="w-full">
                        {t(getTranslationKey(question.name!))}
                    </Button>
                );
            }
            default:
                return null;
        }
    };

    // A top-level question plus its indented children; `prefix` namespaces ids/parents per auto card
    const renderBlock = (question: PitScoutingQuestion, prefix = "") => {
        const children = getChildQuestions(question.label);
        return (
            <div key={prefix + question.id} className="space-y-3">
                <div className="space-y-2">
                    <Label
                        htmlFor={prefix + question.id}
                        className={`text-sm font-semibold ${question.required ? "after:content-['_*'] after:text-destructive" : ""}`}
                    >
                        {t(getTranslationKey(question.label))}
                    </Label>
                    <div className="mt-2">{renderQuestion({...question, id: prefix + question.id})}</div>
                </div>
                {children.length > 0 && (
                    <div className="ml-6 mt-4 space-y-3 border-l-2 border-primary/30 pl-4">
                        {children.map(child => (
                            <div key={child.id}>
                                {renderQuestion({...child, id: prefix + child.id, parent: prefix + child.parent})}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    const sectionCard = (key: string | number, title: string, questions: PitScoutingQuestion[], prefix = "", onRemove?: () => void) => (
        <Card key={key} className="overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-primary/10 to-primary/5">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-lg text-primary">{title}</CardTitle>
                    {onRemove && (
                        <Button size="sm" variant="destructive" onClick={onRemove}>
                            <X className="w-4 h-4"/>
                        </Button>
                    )}
                </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
                {questions.filter(q => !q.parent).map(q => renderBlock(q, prefix))}
            </CardContent>
        </Card>
    );

    return (
        <div className="min-h-screen bg-background">
            <Sidebar activeTab={activeTab} onTabChange={handleTabChange}/>

            <main
                className="md:ml-64 min-h-screen max-h-screen overflow-auto touch-pan-y"
                style={{WebkitOverflowScrolling: "touch"}}
            >
                <TopBar activeTab={activeTab} onTabChange={handleTabChange}/>

                <div className="p-6">
                    <div className="space-y-6">
                        {/* Language Selector */}
                        <div className="flex justify-end mb-4">
                            <div className="flex items-center gap-2">
                                <Label htmlFor="language-select" className="font-semibold">{t('language')}:</Label>
                                <Select value={language} onValueChange={handleLanguageChange}>
                                    <SelectTrigger id="language-select" className="w-32">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="en">English</SelectItem>
                                        <SelectItem value="zh">中文</SelectItem>
                                        <SelectItem value="es">Español</SelectItem>
                                        <SelectItem value="tr">Türkçe</SelectItem>
                                        <SelectItem value="he">עברית</SelectItem>
                                        <SelectItem value="pt">Português</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {!isActive && (
                            <Card>
                                <CardHeader>
                                    <CardTitle>{t('startPitScouting')}</CardTitle>
                                    <CardDescription>
                                        {t('enterTeamNumber')}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="pit-team-number">{t('teamNumber')}</Label>
                                        <Input
                                            id="pit-team-number"
                                            type="text"
                                            inputMode="numeric"
                                            placeholder={t('teamNumberPlaceholder')}
                                            value={teamNumber}
                                            onChange={(e) => setTeamNumber(e.target.value)}
                                        />
                                    </div>

                                    <Button
                                        onClick={() => handleStartScouting()}
                                        className="w-full"
                                        size="lg"
                                        disabled={!teamNumber.trim()}
                                    >
                                        <Play className="w-4 h-4 mr-2"/>
                                        {t('startPitScoutingButton')}
                                    </Button>
                                </CardContent>
                            </Card>
                        )}

                        {isActive && (
                            <Card>
                                <CardHeader>
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <CardTitle>{t('pitScoutingTeam', { team: teamNumber })}</CardTitle>
                                            <CardDescription>
                                                {t('answerAllFields')}
                                            </CardDescription>
                                        </div>
                                        <Button
                                            onClick={handleCancelClick}
                                            variant={cancelConfirm ? "destructive" : "outline"}
                                            size="sm"
                                            className={`${
                                                cancelConfirm
                                                    ? "bg-destructive hover:bg-destructive/90"
                                                    : ""
                                            } whitespace-normal text-left leading-tight flex items-center gap-2 h-auto py-2`}
                                        >
                      <span className="flex-shrink-0">
                        <X className="w-4 h-4"/>
                      </span>
                                            <span className="flex-1 min-w-0">
                        {cancelConfirm
                            ? t('cancelConfirm')
                            : t('cancel')}
                      </span>
                                        </Button>
                                    </div>
                                </CardHeader>
                            </Card>
                        )}

                        {isActive && (
                            <>
                                {Object.entries(groupedQuestions).map(([section, sectionQ]) =>
                                    section === "Autos" ? (
                                        <Fragment key={section}>
                                            {Array.from({length: autoCount}, (_, index) =>
                                                sectionCard(index, t('auto', {number: index + 1}), sectionQ, `auto_${index}_`, () => removeAuto(index)))}
                                            <Button variant="outline" className="w-full" onClick={() => setAutoCount(prev => prev + 1)}>
                                                {t('addAuto')}
                                            </Button>
                                        </Fragment>
                                    ) : sectionCard(section, t(getTranslationKey(section)), sectionQ))}

                                <div className="flex gap-2">
                                    <Button
                                        onClick={handleSubmit}
                                        className="flex-1"
                                        size="lg"
                                    >
                                        {t('submitPitScouting')}
                                    </Button>
                                </div>
                            </>
                        )}

                    </div>
                </div>


                {!isActive && (
                    unscoutedTeams.length === 0 ? (
                        <Card>
                            <CardContent className="py-8">
                                <p className="text-center text-muted-foreground">{t('noPitData')}</p>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="space-y-4 p-6">
                            <Card>
                                <CardHeader>
                                    <CardTitle>{t('unscouted')}</CardTitle>
                                    <CardDescription>
                                        {t('unscouted_description')}
                                    </CardDescription>
                                </CardHeader>


                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6">
                                    {unscoutedTeams.map((entry) => (
                                        <Card key={entry}
                                              className="overflow-hidden cursor-pointer hover:border-primary transition-colors"
                                              onClick={() => handleStartScouting(String(entry))}>
                                            <CardHeader className="p-2">
                                                <CardTitle className="flex justify-center items-center">
                                                    Team {entry}
                                                </CardTitle>
                                            </CardHeader>
                                        </Card>
                                    ))}
                                </div>
                            </Card>
                        </div>
                    ))}
            </main>
        </div>
    );
};

export default PitScouting;
