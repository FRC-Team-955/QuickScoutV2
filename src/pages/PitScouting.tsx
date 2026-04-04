import {useRef, useState} from "react";
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
import {ref, serverTimestamp, set} from "firebase/database";
import {db} from "@/lib/firebase";

interface PitScoutingQuestion {
    id: string;
    label: string;
    section: string;
    type: "text" | "textarea" | "select" | "yes-no" | "number" | "checkbox" | "radio";
    required: boolean;
    placeholder?: string;
    options?: string[];
    parent?: string | null;
}

interface PitScoutingResponse {
    [key: string]: string | number | boolean | null;
}

const PIT_SCOUTING_QUESTIONS: PitScoutingQuestion[] = [
    {
            id: "intake-type",
            label: "Intaking Locations",
            section: "Robot Functions",
            type: "label",
            parent: null
        },
        {
            id: "intake-ground-ground",
            name: "Ground",
            section: "Robot Functions",
            type: "button-group-multi",
            parent: "Intaking Locations"
        },
        {
            id: "intake-ground-outpost",
            name: "Outpost",
            section: "Robot Functions",
            type: "button-group-multi",
            parent: "Intaking Locations"
        },


    {
        id: "climb-level",
        label: "Climb",
        section: "Robot Functions",
        type: "label",
        parent: null
    },
    {
        id: "climb-level-l1",
        name: "L1",
        section: "Robot Functions",
        type: "button-group",
        parent: "Climb"
    },
    {
        id: "climb-level-l2",
        name: "L2",
        section: "Robot Functions",
        type: "button-group",
        parent: "Climb"
    },
    {
        id: "climb-level-l3",
        name: "L3",
        section: "Robot Functions",
        type: "button-group",
        parent: "Climb"
    },
    {
        id: "climb-level-none",
        name: "Nah",
        section: "Robot Functions",
        type: "button-group",
        parent: "Climb"
    },
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
    },
    {
        id: "climb-location-middle",
        name: "Middle",
        section: "Robot Functions",
        type: "button-group-multi",
        required: false,
        parent: "Climb location",
    },
    {
        id: "climb-location-straddling",
        name: "Straddling the Upright",
        section: "Robot Functions",
        type: "button-group-multi",
        required: false,
        parent: "Climb location",
    },
    {
        id: "climb-location-backflip",
        name: "Backflip",
        section: "Robot Functions",
        type: "button-group-multi",
        required: false,
        parent: "Climb location",
    },
    {
        id: "climb-location-other",
        name: "Nah",
        section: "Robot Functions",
        type: "button-group-multi",
        required: false,
        parent: "Climb location",
    },
    {
        id: "under-trench-height",
        label: "Under Trench height (22.25\")",
        section: "Robot capabilities",
        type: "checkbox",
        required: false,
        parent: null,
    },
    {
        id: "over-bump",
        label: "Over the Bump",
        section: "Robot capabilities",
        type: "checkbox",
        required: false,
        parent: null,
    },
    {
        id: "shoot-on-move",
        label: "Shoot on the move",
        section: "Robot capabilities",
        type: "checkbox",
        required: false,
        parent: null,
    },
    {
        id: "pass-fuel",
        label: "Pass Fuel to Alliance Zone",
        section: "Robot capabilities",
        type: "checkbox",
        required: false,
        parent: null,
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
    },
    {
        id: "defense-rating-2",
        name: "2",
        section: "Robot capabilities",
        type: "button-group",
        required: false,
        parent: "Defense rating (1-5):",
    },
    {
        id: "defense-rating-3",
        name: "3",
        section: "Robot capabilities",
        type: "button-group",
        required: false,
        parent: "Defense rating (1-5):",
    },
    {
        id: "defense-rating-4",
        name: "4",
        section: "Robot capabilities",
        type: "button-group",
        required: false,
        parent: "Defense rating (1-5):",
    },
    {
        id: "defense-rating-5",
        name: "5",
        section: "Robot capabilities",
        type: "button-group",
        required: false,
        parent: "Defense rating (1-5):",
    },
    {
        id: "fuel-hopper",
        label: "Approximate amount of fuel in hopper:",
        section: "Robot capabilities",
        type: "text",
        required: false,
        placeholder: "",
        parent: null,
    },
    {
        id: "shooter-type",
        label: "Shooter type (turret, drum shooter, hooded, fixed etc.):",
        section: "Robot capabilities",
        type: "text",
        required: false,
        placeholder: "",
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
    {
        id: "starting-locations",
        label: "Possible starting locations:",
        section: "Autos",
        type: "text",
        required: false,
        placeholder: "",
        parent: null,
    },
    {
        id: "auto-capabilities",
        label: "Capabilities (ex: score 8 pre-loads):",
        section: "Autos",
        type: "text",
        required: false,
        placeholder: "",
        parent: null,
    },
    {
        id: "auto-intake-fuel",
        label: "Auto Intake Fuel",
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
        parent: "Auto Intake Fuel",
    },
    {
        id: "auto-intake-fuel-station",
        name: "Fuel Station",
        section: "Autos",
        type: "button-group-multi",
        required: false,
        parent: "Auto Intake Fuel",
    },
    {
        id: "auto-climb",
        label: "Climb",
        section: "Autos",
        type: "label", // yea just cuz
        required: false,
        parent: null,
    },
    {
        id: "dimensions-weight",
        label: "Dimensions & weight:",
        section: "Drivebase",
        type: "text",
        required: false,
        placeholder: "",
        parent: null,
    },
    {
        id: "special-details",
        label: "Any special details (i.e. swerve type, gearing):",
        section: "Drivebase",
        type: "text",
        required: false,
        placeholder: "",
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

            const pitScoutingRef = ref(
                db,
                `pitScouting/${dateStr}/${teamNumber}/${user.id}`
            );

            await set(pitScoutingRef, {
                teamNumber: parseInt(teamNumber, 10),
                scoutName: user.name || "Unknown",
                scoutId: user.id,
                submittedAt: serverTimestamp(),
                responses,
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
                                        (responses[question.group!] === question.name)? "default" : "outline"
                                    }
                                    onClick={() =>
                                        handleResponseChange(question.group!, question.name)
                                    }
                                    disabled={!isActive}
                                    className="w-full"
                                >
                                    {question.name}
                                </Button>

                    );
            case "button-group-multi":
                const selected = (responses[question.group!] as string[]) || [];
                return (
                    <Button
                        variant={selected.includes(question.name!) ? "default" : "outline"}
                        onClick={() => {
                            const current = (responses[question.group!] as string[]) || [];
                            const next = current.includes(question.name!)
                                ? current.filter(v => v !== question.name)
                                : [...current, question.name!];
                            handleResponseChange(question.group!, next as any);
                        }}
                        disabled={!isActive}
                        className="w-full"
                    >
                        {question.name}
                    </Button>
                );
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
                                {Object.entries(groupedQuestions).map(([section, sectionQ]) => (
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
            </main>
        </div>
    );
};

export default PitScouting;



