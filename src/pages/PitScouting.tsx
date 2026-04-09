import {Fragment, useEffect, useMemo, useRef, useState} from "react";
import {useNavigate} from "react-router-dom";
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
import {getEventTeams} from "@/lib/tba.ts";

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
    {
        id: "intake-type",
        label: "Intaking Locations",
        section: "Robot Functions",
        type: "label",
        parent: null,
        required: false
    },
    {
        id: "intake-ground-neutral-zone",
        name: "Neutral Zone",
        section: "Robot Functions",
        type: "button-group-multi",
        parent: "Intaking Locations",
        label: "",
        required: false
    },
    {
        id: "intake-ground-outpost",
        name: "Outpost",
        section: "Robot Functions",
        type: "button-group-multi",
        parent: "Intaking Locations",
        label: "",
        required: false
    },

    /////////////////////////////////////////// Climb
    {
        id: "climb-level",
        label: "Climb",
        section: "Robot Functions",
        type: "label",
        parent: null,
        required: false
    },
    {
        id: "climb-level-l1",
        name: "L1",
        section: "Robot Functions",
        type: "button-group",
        parent: "Climb",
        label: "",
        required: false
    },
    {
        id: "climb-level-l2",
        name: "L2",
        section: "Robot Functions",
        type: "button-group",
        parent: "Climb",
        label: "",
        required: false
    },
    {
        id: "climb-level-l3",
        name: "L3",
        section: "Robot Functions",
        type: "button-group",
        parent: "Climb",
        label: "",
        required: false
    },
    {
        id: "climb-level-none",
        name: "Nah",
        section: "Robot Functions",
        type: "button-group",
        parent: "Climb",
        label: "",
        required: false
    },



    ///////////////// CLimb Location
    {
        id: "climb-location",
        label: "Climb location",
        section: "Robot Functions",
        type: "label",
        required: false,
        parent: null,
    },
    {
        id: "climb-location-side",
        name: "Side",
        section: "Robot Functions",
        type: "button-group-multi",
        required: false,
        parent: "Climb location",
        label: ""
    },
    {
        id: "climb-location-middle",
        name: "Middle",
        section: "Robot Functions",
        type: "button-group-multi",
        required: false,
        parent: "Climb location",
        label: ""
    },
    {
        id: "climb-location-straddling",
        name: "Straddling the Upright",
        section: "Robot Functions",
        type: "button-group-multi",
        required: false,
        parent: "Climb location",
        label: ""
    },
    {
        id: "climb-location-backflip",
        name: "Backflip",
        section: "Robot Functions",
        type: "button-group-multi",
        required: false,
        parent: "Climb location",
        label: ""
    },
    {
        id: "climb-location-other",
        name: "Nah",
        section: "Robot Functions",
        type: "button-group-multi",
        required: false,
        parent: "Climb location",
        label: ""
    },
    {
        id: "size-constraints",
        label: "Size Constraints",
        section: "Robot capabilities",
        type: "label",
        required: false,
        parent: null,
    },
    {
        id: "under-trench-height",
        name: "Under Trench height (22.25\")",
        section: "Robot capabilities",
        type: "button-group-multi",
        required: false,
        parent: "Size Constraints",
        label: ""
    },
    {
        id: "over-bump",
        name: "Over the Bump",
        section: "Robot capabilities",
        type: "button-group-multi",
        required: false,
        parent: "Size Constraints",
        label: ""
    },
    {
        id: "shooting-capabilities",
        label: "Shooting Capabilities",
        section: "Robot capabilities",
        type: "label",
        required: false,
        parent: null,
    },
    {
        id: "shoot-on-move",
        name: "Shoot on the Move",
        section: "Robot capabilities",
        type: "button-group-multi",
        required: false,
        parent: "Shooting Capabilities",
        label: ""
    },
    {
        id: "pass-fuel",
        name: "Pass Fuel to Alliance Zone",
        section: "Robot capabilities",
        type: "button-group-multi",
        required: false,
        parent: "Shooting Capabilities",
        label: ""
    },
    {
        id: "defense-rating",
        label: "Defense rating (1-5):",
        section: "Robot capabilities",
        type: "label",
        required: false,
        parent: null,
    },
    {
        id: "defense-rating-1",
        name: "1",
        section: "Robot capabilities",
        type: "button-group",
        required: false,
        parent: "Defense rating (1-5):",
        label: ""
    },
    {
        id: "defense-rating-2",
        name: "2",
        section: "Robot capabilities",
        type: "button-group",
        required: false,
        parent: "Defense rating (1-5):",
        label: ""
    },
    {
        id: "defense-rating-3",
        name: "3",
        section: "Robot capabilities",
        type: "button-group",
        required: false,
        parent: "Defense rating (1-5):",
        label: ""
    },
    {
        id: "defense-rating-4",
        name: "4",
        section: "Robot capabilities",
        type: "button-group",
        required: false,
        parent: "Defense rating (1-5):",
        label: ""
    },
    {
        id: "defense-rating-5",
        name: "5",
        section: "Robot capabilities",
        type: "button-group",
        required: false,
        parent: "Defense rating (1-5):",
        label: ""
    },
    {
        id: "fuel-hopper",
        label: "Approximate max fuel in hopper:",
        placeholder: "",
        section: "Robot capabilities",
        type: "text",
        required: false,
        parent: null,
    },

    {
        id: "shooter-type",
        label: "Shooter type:",
        section: "Robot capabilities",
        type: "text",
        required: false,
        placeholder: "eg., turret, drum shooter, hooded, fixed",
        parent: null,
    },
    {
        id: "bps",
        label: "BPS (balls per sec):",
        section: "Robot capabilities",
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
        section: "Robot Functions",
        type: "button-group",
        parent: "How easily can they modify autos (on the spot)?",
        label: "",
        required: false
    },
    {
        id: "modify-autos-hard",
        name: "Hard to change",
        section: "Robot Functions",
        type: "button-group",
        parent: "How easily can they modify autos (on the spot)?",
        label: "",
        required: false
    },
    {
        id: "modify-autos-medium",
        name: "Medium",
        section: "Robot Functions",
        type: "button-group",
        parent: "How easily can they modify autos (on the spot)?",
        label: "",
        required: false
    },
    {
        id: "modify-autos-easy",
        name: "Easy to change",
        section: "Robot Functions",
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
        type: "text",
        required: false,
        placeholder: "Please list locations along this auto's path.",
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
        id: "shooting-notes",
        section: "Autos",
        type: "text",
        required: false,
        placeholder: "eg., Jams often, Shoot on the Move",
        parent: null,
        label: "Notes on shooting:",
    },
    {
        id: "auto-climb",
        label: "Climb",
        section: "Autos",
        type: "label", // yea just cuz
        required: false,
        parent: null,
    }, // this one duplicates the climb options from robot capabilities section

    ///// Drivebase
    {
        id: "dimensions",
        label: "Dimensions (with bumpers):",
        section: "Drivebase",
        type: "text",
        required: false,
        placeholder: "ex. 31\"x28\"",
        parent: null,
    },
    {
        id: "weight",
        label: "Weight (with bumpers/battery):",
        section: "Drivebase",
        type: "text",
        required: false,
        placeholder: "ex. 74.9 lbs",
        parent: null,
    },
    {
        id: "special-details",
        label: "Any special details:",
        section: "Drivebase",
        type: "text",
        required: false,
        placeholder: "eg., swerve type, gearing",
        parent: null,
    },
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

const PitScouting = () => {
    const {user} = useAuth();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState("pit-scouting");

    const [unscoutedTeams, setUnscoutedTeams] = useState<number[]>([]);

    useEffect(() => {
        const initData = async () => {

            const teamKeys: string[] = await getEventTeams("2025orore");
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
                            Yes
                        </Button>
                        <Button
                            variant={value === "no" ? "default" : "outline"}
                            onClick={() => handleResponseChange(question.id, "no")}
                            disabled={!isActive}
                            className="flex-1"
                        >
                            No
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
                                        (responses[question.parent!] === question.name)? "default" : "outline"
                                    }
                                    onClick={() =>
                                        handleResponseChange(question.parent!, question.name)
                                    }
                                    disabled={!isActive}
                                    className="w-full"
                                >
                                    {question.name}
                                </Button>

                    );
            case "button-group-multi":
                { const selected = (responses[question.parent!] as string[]) || [];
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
                        {question.name}
                    </Button>
                ); }
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
                        {!isActive && (
                            <Card>
                                <CardHeader>
                                    <CardTitle>Start Pit Scouting Session</CardTitle>
                                    <CardDescription>
                                        Enter the team number you're scouting
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="pit-team-number">Team Number</Label>
                                        <Input
                                            id="pit-team-number"
                                            type="text"
                                            inputMode="numeric"
                                            placeholder="Enter team number"
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
                                        Start Pit Scouting
                                    </Button>
                                </CardContent>
                            </Card>
                        )}

                        {isActive && (
                            <Card>
                                <CardHeader>
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <CardTitle>Pit Scouting - Team {teamNumber}</CardTitle>
                                            <CardDescription>
                                                Answer all fields
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
                            ? "Are you sure? Click again to cancel"
                            : "Cancel"}
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
                                                {Array.from({ length: autoCount }).map((_, index) => (
                                                    <Card key={index} className="overflow-hidden">
                                                        <CardHeader className="bg-gradient-to-r from-primary/10 to-primary/5">
                                                            <div className="flex items-center justify-between">
                                                                <CardTitle className="text-lg text-primary">
                                                                    Auto {index + 1}
                                                                </CardTitle>
                                                                {(
                                                                    <Button size="sm" variant="destructive" onClick={() => setAutoCount(prev => prev - 1)}>
                                                                        <X className="w-4 h-4" />
                                                                    </Button>
                                                                )}
                                                            </div>
                                                        </CardHeader>
                                                        <CardContent className="pt-6 space-y-6">
                                                            {sectionQ.filter(q => !q.parent).map((question) => {
                                                                const prefixed = { ...question, id: `auto_${index}_${question.id}` };
                                                                return (
                                                                    <div key={prefixed.id} className="space-y-3">
                                                                        <div className="space-y-2">
                                                                            <Label className="text-sm font-semibold">{question.label}</Label>
                                                                            <div className="mt-2">{renderQuestion(prefixed)}</div>
                                                                        </div>
                                                                        {/* Render child questions with indentation */}
                                                                        {getChildQuestions(question.label).length > 0 && (
                                                                            <div className="ml-6 mt-4 space-y-3 border-l-2 border-primary/30 pl-4">
                                                                                {getChildQuestions(question.label).map(child => (
                                                                                    <div key={child.id} className="flex-1 min-w-[80px]">
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
                                                <Button variant="outline" className="w-full" onClick={() => setAutoCount(prev => prev + 1)}>
                                                    + Add Auto
                                                </Button>
                                            </Fragment>
                                        ) :
                                        (
                                    <Card key={section} className="overflow-hidden">
                                        <CardHeader className="bg-gradient-to-r from-primary/10 to-primary/5">
                                            <CardTitle className="text-lg text-primary">{section}</CardTitle>
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
                                                            {question.label}
                                                        </Label>
                                                        <div className={question.type === "checkbox" ? "" : "mt-2"}>
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
                                                                                {childQuestion.label}
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
                                        Submit Pit Scouting
                                    </Button>
                                </div>
                            </>
                        )}

                        {loading && isActive && (
                            <Card>
                                <CardContent className="pt-6">
                                    <p className="text-muted-foreground">
                                        Loading pit scouting form...
                                    </p>
                                </CardContent>
                            </Card>
                        )}
                    </div>
                </div>




                {loading ? (
                    <Card>
                        <CardContent className="py-8">
                            <p className="text-center text-muted-foreground">Loading pit scouting
                                data...</p>
                        </CardContent>
                    </Card>
                ) : unscoutedTeams.length === 0 ? (
                    <Card>
                        <CardContent className="py-8">
                            <p className="text-center text-muted-foreground">No pit scouting data
                                available</p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-4">


                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {(unscoutedTeams
                            ).map((entry) => {


                                return (
                                    <Card key={entry} className="overflow-hidden">
                                        <CardHeader
                                            className="bg-gradient-to-r from-primary/10 to-primary/5 pb-3">
                                            <CardTitle className="flex justify-between items-start gap-3">
                                                <div className="flex flex-col gap-1">
                                                                <span
                                                                    className="text-2xl font-bold">Team {entry}</span>

                                                </div>

                                            </CardTitle>
                                        </CardHeader>

                                    </Card>
                                );
                            })}
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

export default PitScouting;



