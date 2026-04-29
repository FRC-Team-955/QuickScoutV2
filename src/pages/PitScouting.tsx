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
import {Checkbox} from "@/components/ui/checkbox";
import {useAuth} from "@/contexts/AuthContext";
import {Play, X} from "lucide-react";
import {toast} from "sonner";
import {get, ref, serverTimestamp, set} from "firebase/database";
import {db} from "@/lib/firebase";
import {PitScoutingEntry} from "@/pages/Analytics.tsx";
import {TBA_EVENT_KEY, getEventTeams} from "@/lib/tba.ts";

interface PitScoutingQuestion {
    id: string;
    label: string;
    section: string;
    name?: string | null; //used for buttons and multi-buttons
    type: "text" | "textarea" | "select" | "yes-no" | "number" | "checkbox" | "radio" | "label" | "button-group" | "button-group-multi";
    required: boolean;
    placeholder?: string;
    options?: string[];
    parent?: string | null;
    group?: string | null;
}

interface PitScoutingResponse {
    [key: string]: string | number | boolean | null;
}


const PIT_SCOUTING_QUESTIONS: PitScoutingQuestion[] = [

    ///////////// Intake Type


    /////////////////////////////////////////// Climb
    {
        id: "climb-level",
        label: "Climb",
        section: "Robot Capabilities",
        type: "label",
        parent: null,
        required: false
    },
    {
        id: "climb-level-l1",
        name: "L1",
        section: "Robot Capabilities",
        type: "button-group",
        parent: "Climb",
        label: "",
        required: false
    },
    {
        id: "climb-level-l2",
        name: "L2",
        section: "Robot Capabilities",
        type: "button-group",
        parent: "Climb",
        label: "",
        required: false
    },
    {
        id: "climb-level-l3",
        name: "L3",
        section: "Robot Capabilities",
        type: "button-group",
        parent: "Climb",
        label: "",
        required: false
    },
    {
        id: "climb-level-none",
        name: "Nah",
        section: "Robot Capabilities",
        type: "button-group",
        parent: "Climb",
        label: "",
        required: false
    },


    ///////////////// CLimb Location

    {
        id: "size-constraints",
        label: "Size Constraints",
        section: "Robot Capabilities",
        type: "label",
        required: false,
        parent: null,
    },
    {
        id: "under-trench-height",
        name: "Under Trench height (22.25\")",
        section: "Robot Capabilities",
        type: "button-group-multi",
        required: false,
        parent: "Size Constraints",
        label: ""
    },
    {
        id: "over-bump",
        name: "Over the Bump",
        section: "Robot Capabilities",
        type: "button-group-multi",
        required: false,
        parent: "Size Constraints",
        label: ""
    },
    {
        id: "shooting-capabilities",
        label: "Shooting Capabilities",
        section: "Robot Capabilities",
        type: "label",
        required: false,
        parent: null,
    },
    {
        id: "shoot-on-move",
        name: "Shoot on the Move",
        section: "Robot Capabilities",
        type: "button-group-multi",
        required: false,
        parent: "Shooting Capabilities",
        label: ""
    },
    {
        id: "pass-fuel",
        name: "Pass Fuel to Alliance Zone",
        section: "Robot Capabilities",
        type: "button-group-multi",
        required: false,
        parent: "Shooting Capabilities",
        label: ""
    },
    {
        id: "defense-rating",
        label: "Defense rating (1-5):",
        section: "Robot Capabilities",
        type: "label",
        required: false,
        parent: null,
    },
    {
        id: "defense-rating-1",
        name: "1",
        section: "Robot Capabilities",
        type: "button-group",
        required: false,
        parent: "Defense rating (1-5):",
        label: ""
    },
    {
        id: "defense-rating-2",
        name: "2",
        section: "Robot Capabilities",
        type: "button-group",
        required: false,
        parent: "Defense rating (1-5):",
        label: ""
    },
    {
        id: "defense-rating-3",
        name: "3",
        section: "Robot Capabilities",
        type: "button-group",
        required: false,
        parent: "Defense rating (1-5):",
        label: ""
    },
    {
        id: "defense-rating-4",
        name: "4",
        section: "Robot Capabilities",
        type: "button-group",
        required: false,
        parent: "Defense rating (1-5):",
        label: ""
    },
    {
        id: "defense-rating-5",
        name: "5",
        section: "Robot Capabilities",
        type: "button-group",
        required: false,
        parent: "Defense rating (1-5):",
        label: ""
    },
    {
        id: "fuel-hopper",
        label: "Approximate max fuel in hopper:",
        placeholder: "",
        section: "Robot Capabilities",
        type: "text",
        required: false,
        parent: null,
    },

    {
        id: "shooter-type",
        label: "Shooter type:",
        section: "Robot Capabilities",
        type: "text",
        required: false,
        placeholder: "eg., turret, drum shooter, hooded, fixed",
        parent: null,
    },
    {
        id: "bps",
        label: "BPS (balls per sec):",
        section: "Robot Capabilities",
        type: "text",
        required: false,
        placeholder: "",
        parent: null,
    },

    ///// AUtos
    {
        id: "modify-autos",
        label: "How easily can they modify autos (on the spot)?",
        section: "Auto Capabilities",
        type: "label",
        parent: null,
        required: false
    },
    {
        id: "modify-autos-cannot",
        name: "Can't change at comp",
        section: "Robot Capabilities",
        type: "button-group",
        parent: "How easily can they modify autos (on the spot)?",
        label: "",
        required: false
    },
    {
        id: "modify-autos-hard",
        name: "Hard to change",
        section: "Robot Capabilities",
        type: "button-group",
        parent: "How easily can they modify autos (on the spot)?",
        label: "",
        required: false
    },
    {
        id: "modify-autos-medium",
        name: "Medium",
        section: "Robot Capabilities",
        type: "button-group",
        parent: "How easily can they modify autos (on the spot)?",
        label: "",
        required: false
    },
    {
        id: "modify-autos-easy",
        name: "Easy to change",
        section: "Robot Capabilities",
        type: "button-group",
        parent: "How easily can they modify autos (on the spot)?",
        label: "",
        required: false
    },


    {
        id: "auto-description",
        section: "Autos",
        type: "text",
        placeholder: "This auto does...",
        required: false,
        parent: null,
        label: "Auto Description"
    },
    {
        id: "starting-locations",
        label: "Starting Location",
        section: "Autos",
        type: "label",
        required: false,
        placeholder: "",
        parent: null,
    },
    {
        id: "starting-locations-center",
        label: "",
        name: "Center (in front of hub)",
        section: "Autos",
        type: "button-group",
        required: false,
        parent: "Starting Location",
    },
    {
        id: "starting-locations-left-trench",
        label: "",
        name: "Left Trench",
        section: "Autos",
        type: "button-group",
        required: false,
        parent: "Starting Location",
    },
    {
        id: "starting-locations-right-trench",
        label: "",
        name: "Right Trench",
        section: "Autos",
        type: "button-group",
        required: false,
        parent: "Starting Location",
    },
    {
        id: "starting-locations-left-bump",
        label: "",
        name: "Left Bump",
        section: "Autos",
        type: "button-group",
        required: false,
        parent: "Starting Location",
    },
    {
        id: "starting-locations-right-bump",
        label: "",
        name: "Right Bump",
        section: "Autos",
        type: "button-group",
        required: false,
        parent: "Starting Location",
    },
    {
        id: "starting-locations-other",
        name: "Other",
        section: "Autos",
        type: "button-group",
        required: false,
        parent: "Starting Location",
        label: ""
    },
    {
        id: "starting-locations-other-text",
        section: "Autos",
        type: "text",
        required: false,
        placeholder: "Other starting location:",
        parent: "Starting Location",
        label: "",
    },
    // move through locations
    {
        id: "auto-locations",
        label: "Cycle Path",
        section: "Autos",
        type: "textarea",
        required: false,
        placeholder: "eg., start left trench, cycle neutral through left trench, back to alliance through left bump, repeat, stop at left side hub.",
        parent: null,
    },


    {
        id: "fuel-scoring",
        label: "Preloaded Fuel",
        section: "Autos",
        type: "label",
        required: false,
        parent: null,
    },
    {
        id: "score-preloads",
        name: "Shoot",
        section: "Autos",
        type: "button-group",
        required: false,
        parent: "Preloaded Fuel",
        label: ""
    },
    {
        id: "no-shoot-preloads-neutral-zone",
        name: "No shoot (races to neutral zone)",
        section: "Autos",
        type: "button-group",
        required: false,
        parent: "Preloaded Fuel",
        label: ""
    },
    {
        id: "no-shoot-preloads-cant-shoot",
        name: "No shoot (can't shoot)",
        section: "Autos",
        type: "button-group",
        required: false,
        parent: "Preloaded Fuel",
        label: ""
    },

    /*
    {
        id: "auto-intake-fuel",
        label: "Intaking Locations ",
        section: "Autos",
        type: "label",
        required: false,
        parent: null,
    },
    {
        id: "auto-intake-fuel-ground",
        name: "Ground",
        section: "Autos",
        type: "button-group-multi",
        required: false,
        parent: "Intaking Locations ",
        label: ""
    },
    {
        id: "auto-intake-outpost-chute",
        name: "Outpost",
        section: "Autos",
        type: "button-group-multi",
        required: false,
        parent: "Intaking Locations ",
        label: ""
    },
    {
        id: "auto-intake-depot",
        name: "Depot",
        section: "Autos",
        type: "button-group-multi",
        required: false,
        parent: "Intaking Locations ",
        label: ""
    },
    */

    {
        id: "estimated-fuel",
        section: "Autos",
        type: "text",
        required: false,
        placeholder: "",
        parent: null,
        label: "Estimated Fuel Scored:",
    },
    {
        id: "auto-climb",
        label: "Climb",
        section: "Autos",
        type: "label", // yea just cuz
        required: false,
        parent: null,
    }, // this one duplicates the climb options from Robot Capabilities section


    {
        id: "robot-strengths",
        label: "Robot Strengths",
        section: "Strategy & Notes",
        type: "textarea",
        required: false,
        placeholder: "What are the main strengths of this robot?",
    },
    {
        id: "robot-weaknesses",
        label: "Robot Weaknesses",
        section: "Strategy & Notes",
        type: "textarea",
        required: false,
        placeholder: "What are the main weaknesses of this robot?",
    },
    {
        id: "notable-features",
        label: "Notable Features",
        section: "Strategy & Notes",
        type: "textarea",
        required: false,
        placeholder: "Any unique mechanisms or features?",
    },
    {
        id: "driver-experience",
        label: "Driver Experience",
        section: "Strategy & Notes",
        type: "textarea",
        required: false,
        placeholder: "Experience of the driveteam(s)",
    },
    {
        id: "additional-notes",
        label: "Additional Notes",
        section: "Strategy & Notes",
        type: "textarea",
        required: false,
        placeholder: "Any other observations from pit scouting?",
    },
];

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

    useEffect(() => {
        const initData = async () => {

            const teamKeys: string[] = await getEventTeams(TBA_EVENT_KEY);
            const teamNumbers = teamKeys
                .map(key => parseInt(key.replace("frc", ""), 10))
                .sort((a, b) => a - b);


            const pitScoutingRef = ref(db, "pitScouting");
            const pitSnap = await get(pitScoutingRef);
            if (!pitSnap.exists()) {
                setUnscoutedTeams([]);
            } else {
                const pitData = pitSnap.val();
                const allPitEntries: PitScoutingEntry[] = [];
                Object.entries(pitData).forEach(([dateStr, dateValue]: [string, Record<string, unknown>]) => {
                    if (!dateValue || typeof dateValue !== 'object') return;
                    Object.entries(dateValue).forEach(([teamNum, teamValue]: [string, Record<string, unknown>]) => {
                        if (!teamValue || typeof teamValue !== 'object') return;
                        Object.entries(teamValue).forEach(([userId, entryValue]: [string, Record<string, unknown>]) => {
                            if (!entryValue || typeof entryValue !== 'object') return;
                            allPitEntries.push({
                                id: `${dateStr}_${teamNum}_${userId}`,
                                dateStr,
                                teamNumber: (entryValue.teamNumber as number) || parseInt(teamNum, 10) || 0,
                                scoutName: (entryValue.scoutName as string) || "Unknown",
                                scoutId: (entryValue.scoutId as string) || userId || "",
                                responses: (entryValue.responses as Record<string, unknown>) || {},
                                submittedAt: (entryValue.submittedAt as number) || 0,
                            });
                        });
                    });
                });
                const scoutedSet = new Set(allPitEntries.map(e => e.teamNumber));
                const unscouted = teamNumbers.filter(t => !scoutedSet.has(t));

                setUnscoutedTeams(unscouted);
            }
        };
        initData();
    }, []); //  empty array means run once on mount


    const handleTabChange = (tab: string) => {
        setActiveTab(tab);
        if (tab === "dashboard") {
            navigate("/dashboard");
        } else if (tab === "scouting") {
            navigate("/scouting");
        } else if (tab === "pit-scouting") {
            navigate("/pit-scouting");
        } else if (tab === "analytics") {
            navigate("/analytics");
        } else if (tab === "matches") {
            navigate("/matches");
        } else if (tab === "leaderboard") {
            navigate("/leaderboard");
        }
    };

    const handleLanguageChange = (lang: string) => {
        setLanguage(lang);
        i18n.changeLanguage(lang);
    };

    const [questions] = useState<PitScoutingQuestion[]>(PIT_SCOUTING_QUESTIONS);
    const [loading] = useState(false);
    const [responses, setResponses] = useState<PitScoutingResponse>({});
    const [isActive, setIsActive] = useState(false);
    const [teamNumber, setTeamNumber] = useState("");
    const [cancelConfirm, setCancelConfirm] = useState(false);
    const cancelTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const [autoCount, setAutoCount] = useState(0);


    const handleStartScouting = (teamNum?: string) => {
        const effectiveTeam = (typeof teamNum === "string" ? teamNum : teamNumber)
            .trim()
            .replace(/[^0-9]/g, "");

        if (!effectiveTeam) {
            toast("Please enter a valid team number");
            return;
        }

        setTeamNumber(effectiveTeam);
        setIsActive(true);
        setResponses({});
        setCancelConfirm(false);
    };

    const handleResponseChange = (questionId: string, value: string | number | boolean) => {
        setResponses((prev) => ({
            ...prev,
            [questionId]: value,
        }));
    };

    const handleSubmit = async () => {
        //const everything_but_autos =

        if (!user?.id) {
            toast("You must be logged in to submit pit scouting data");
            return;
        }

        const missingRequired = questions
            .filter((q) => q.required)
            .filter((q) => !responses[q.id]);

        if (missingRequired.length > 0) {
            toast(
                `Please answer all required questions: ${missingRequired.map((q) => q.label).join(", ")}`
            );
            return;
        }

        try {
            const now = new Date();
            const dateStr = now.toISOString().split("T")[0]; // YYYY-MM-DD

            const autoResponses: Record<string, Record<string, any>> = {};
            const flatResponses: PitScoutingResponse = {};

            Object.entries(responses).forEach(([key, value]) => {
                const autoMatch = key.match(/^auto_(\d+)_(.+)$/);
                if (autoMatch) {
                    const index = autoMatch[1];
                    const fieldId = autoMatch[2];
                    if (!autoResponses[index]) autoResponses[index] = {};
                    autoResponses[index][fieldId] = value;
                } else {
                    flatResponses[key] = value;
                }
            });

            const pitScoutingRef = ref(
                db,
                `pitScouting/${dateStr}/${teamNumber}/${user.id}`
            );

            await set(pitScoutingRef, {
                teamNumber: parseInt(teamNumber, 10),
                scoutName: user.name || "Unknown",
                scoutId: user.id,
                submittedAt: serverTimestamp(),
                ...flatResponses,        // all non-auto at the top level
                ...Object.fromEntries(
                    Object.entries(autoResponses).map(([index, data]) => [`auto${index}`, data]))

            });

            toast("Pit scouting data submitted successfully!");
            resetForm();
        } catch (err) {
            console.error("Failed to submit pit scouting data:", err);
            toast("Failed to save pit scouting data. Please try again.");
        }
    };

    const handleCancelClick = () => {
        if (!cancelConfirm) {
            setCancelConfirm(true);
            if (cancelTimeoutRef.current) {
                clearTimeout(cancelTimeoutRef.current);
            }
            cancelTimeoutRef.current = setTimeout(() => {
                setCancelConfirm(false);
            }, 3000);
        } else {
            resetForm();
            setCancelConfirm(false);
            if (cancelTimeoutRef.current) {
                clearTimeout(cancelTimeoutRef.current);
                cancelTimeoutRef.current = null;
            }
        }
    };

    const resetForm = () => {
        setIsActive(false);
        setTeamNumber("");
        setResponses({});
        setCancelConfirm(false);
    };

    const groupedQuestions = questions.reduce(
        (acc, q) => {
            if (!acc[q.section]) {
                acc[q.section] = [];
            }
            acc[q.section].push(q);
            return acc;
        },
        {} as Record<string, PitScoutingQuestion[]>
    );

    const getChildQuestions = (parentLabel: string): PitScoutingQuestion[] => {
        return questions.filter(q => q.parent === parentLabel);
    };

    const renderQuestion = (question: PitScoutingQuestion) => {
        const value = responses[question.id];

        switch (question.type) {
            case "text":
                return (
                    <Input
                        type="text"
                        placeholder={question.placeholder}
                        value={(value as string) || ""}
                        onChange={(e) => handleResponseChange(question.id, e.target.value)}
                        disabled={!isActive}
                    />
                );

            case "textarea":
                return (
                    <Textarea
                        placeholder={question.placeholder}
                        value={(value as string) || ""}
                        onChange={(e) => handleResponseChange(question.id, e.target.value)}
                        disabled={!isActive}
                        className="min-h-[100px]"
                    />
                );

            case "select":
                return (
                    <Select
                        value={(value as string) || ""}
                        onValueChange={(v) => handleResponseChange(question.id, v)}
                        disabled={!isActive}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Select an option"/>
                        </SelectTrigger>
                        <SelectContent>
                            {question.options?.map((option) => (
                                <SelectItem key={option} value={option}>
                                    {option}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                );

            case "yes-no":
                return (
                    <div className="flex gap-2">
                        <Button
                            variant={value === "yes" ? "default" : "outline"}
                            onClick={() => handleResponseChange(question.id, "yes")}
                            disabled={!isActive}
                            className="flex-1"
                        >
                            {t('yes')}
                        </Button>
                        <Button
                            variant={value === "no" ? "default" : "outline"}
                            onClick={() => handleResponseChange(question.id, "no")}
                            disabled={!isActive}
                            className="flex-1"
                        >
                            {t('no')}
                        </Button>
                    </div>
                );

            case "number":
                return (
                    <Input
                        type="number"
                        placeholder={question.placeholder}
                        value={(value as number) || ""}
                        onChange={(e) =>
                            handleResponseChange(question.id, parseInt(e.target.value, 10))
                        }
                        disabled={!isActive}
                    />
                );

            case "checkbox":
                return (
                    <div className="flex items-center gap-2">
                        <Checkbox
                            id={question.id}
                            checked={(value as boolean) || false}
                            onCheckedChange={(checked) => handleResponseChange(question.id, checked)}
                            disabled={!isActive}


                        />

                    </div>
                );

            case "radio":
                return (
                    <div className="flex items-center gap-3">
                        <input
                            type="radio"
                            id={question.id}
                            name={question.parent || question.section}
                            value={question.label}
                            checked={(value as string) === question.label}
                            onChange={(e) => handleResponseChange(question.id, e.target.value)}
                            disabled={!isActive}
                            className="w-4 h-4 cursor-pointer"
                        />
                        <Label htmlFor={question.id} className="cursor-pointer">
                            {question.label}
                        </Label>
                    </div>
                );
            case "button-group":
                return (
                    // no div?
                    <Button
                        variant={
                            (responses[question.parent!] === question.name) ? "default" : "outline"
                        }
                        onClick={() =>
                            handleResponseChange(question.parent!, question.name)
                        }
                        disabled={!isActive}
                        className="w-full"
                    >
                        {t(getTranslationKey(question.name!))}
                    </Button>

                );
            case "button-group-multi": {
                const selected = (responses[question.parent!] as string[]) || [];
                return (
                    <Button
                        variant={selected.includes(question.name!) ? "default" : "outline"}
                        onClick={() => {
                            const current = (responses[question.parent!] as string[]) || [];
                            const next = current.includes(question.name!)
                                ? current.filter(v => v !== question.name)
                                : [...current, question.name!];
                            handleResponseChange(question.parent!, next as any);
                        }}
                        disabled={!isActive}
                        className="w-full"
                    >
                        {t(getTranslationKey(question.name!))}
                    </Button>
                );
            }
            default:
                return null;
        }
    };

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

                        {isActive && !loading && (
                            <>
                                {Object.entries(groupedQuestions).map(([section, sectionQ]) =>
                                    section === "Autos" ? (
                                            <Fragment key={section}>
                                                {Array.from({length: autoCount}).map((_, index) => (
                                                    <Card key={index} className="overflow-hidden">
                                                        <CardHeader
                                                            className="bg-gradient-to-r from-primary/10 to-primary/5">
                                                            <div className="flex items-center justify-between">
                                                                <CardTitle className="text-lg text-primary">
                                                                    {t('auto', { number: index + 1 })}
                                                                </CardTitle>
                                                                {(
                                                                    <Button size="sm" variant="destructive"
                                                                            onClick={() => setAutoCount(prev => prev - 1)}>
                                                                        <X className="w-4 h-4"/>
                                                                    </Button>
                                                                )}
                                                            </div>
                                                        </CardHeader>
                                                        <CardContent className="pt-6 space-y-6">
                                                            {sectionQ.filter(q => !q.parent).map((question) => {
                                                                const prefixed = {
                                                                    ...question,
                                                                    id: `auto_${index}_${question.id}`
                                                                };
                                                                return (
                                                                    <div key={prefixed.id} className="space-y-3">
                                                                        <div className="space-y-2">
                                                                            <Label
                                                                                className="text-sm font-semibold">{t(getTranslationKey(question.label))}</Label>
                                                                            <div
                                                                                className="mt-2">{renderQuestion(prefixed)}</div>
                                                                        </div>
                                                                        {/* Render child questions with indentation */}
                                                                        {getChildQuestions(question.label).length > 0 && (
                                                                            <div
                                                                                className="ml-6 mt-4 space-y-3 border-l-2 border-primary/30 pl-4">
                                                                                {getChildQuestions(question.label).map(child => (
                                                                                    <div key={child.id}
                                                                                         className="flex-1 min-w-[80px]">
                                                                                        {renderQuestion({
                                                                                            ...child,
                                                                                            id: `auto_${index}_${child.id}`,
                                                                                            parent: `auto_${index}_${child.parent}`,
                                                                                        })}
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })}
                                                        </CardContent>
                                                    </Card>
                                                ))}
                                                <Button variant="outline" className="w-full"
                                                        onClick={() => setAutoCount(prev => prev + 1)}>
                                                    {t('addAuto')}
                                                </Button>
                                            </Fragment>
                                        ) :
                                        (
                                            <Card key={section} className="overflow-hidden">
                                                <CardHeader className="bg-gradient-to-r from-primary/10 to-primary/5">
                                                    <CardTitle className="text-lg text-primary">{t(getTranslationKey(section))}</CardTitle>
                                                </CardHeader>
                                                <CardContent className="pt-6 space-y-6">
                                                    {sectionQ.filter(q => !q.parent).map((question) => (
                                                        <div key={question.id} className="space-y-3">
                                                            <div className="space-y-2">
                                                                <Label
                                                                    htmlFor={question.id}
                                                                    className={`text-sm font-semibold ${
                                                                        question.required ? "after:content-['_*'] after:text-destructive" : ""
                                                                    }`}
                                                                >
                                                                    {t(getTranslationKey(question.label))}
                                                                </Label>
                                                                <div
                                                                    className={question.type === "checkbox" ? "" : "mt-2"}>
                                                                    {renderQuestion(question)}
                                                                </div>
                                                            </div>
                                                            {/* Render child questions with indentation */}
                                                            {getChildQuestions(question.label).length > 0 && (
                                                                <div
                                                                    className="ml-6 mt-4 space-y-3 border-l-2 border-primary/30 pl-4">
                                                                    {getChildQuestions(question.label).map((childQuestion) => (
                                                                        <div key={childQuestion.id}>
                                                                            {childQuestion.type === "radio" ? (
                                                                                <div className="py-2">
                                                                                    {renderQuestion(childQuestion)}
                                                                                </div>
                                                                            ) : (
                                                                                <>
                                                                                    <Label htmlFor={childQuestion.id}
                                                                                           className="text-sm font-medium">
                                                                                        {t(getTranslationKey(childQuestion.label))}
                                                                                    </Label>
                                                                                    <div className="mt-2">
                                                                                        {renderQuestion(childQuestion)}
                                                                                    </div>
                                                                                </>
                                                                            )}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </CardContent>
                                            </Card>

                                        ))}

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

                        {loading && isActive && (
                            <Card>
                                <CardContent className="pt-6">
                                    <p className="text-muted-foreground">
                                        {t('loadingPitForm')}
                                    </p>
                                </CardContent>
                            </Card>
                        )}
                    </div>
                </div>


                {!isActive && (
                    loading ? (
                        <Card>
                            <CardContent className="py-8">
                                <p className="text-center text-muted-foreground">{t('loadingPitData')}</p>
                            </CardContent>
                        </Card>
                    ) : unscoutedTeams.length === 0 ? (
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



