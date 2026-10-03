import {ReactNode, useState} from "react";
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card";
import {Input} from "@/components/ui/input";
import {
    categorizePitResponses,
    formatKey,
    formatValue,
    MatchEntry,
    MatchStats,
    PitScoutingEntry,
    SubjectiveScoutingEntry,
} from "./data";

const pstDate = (ts: number) => new Date(ts).toLocaleDateString([], {timeZone: "America/Los_Angeles"});

export const TeamNumberInput = ({value, onChange, placeholder, label, className = "w-49"}: {
    value: string;
    onChange: (v: string) => void;
    placeholder: string;
    label: string;
    className?: string;
}) => (
    <Input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
        onKeyDown={(e) => {
            if (e.ctrlKey || e.metaKey || e.altKey) return;
            if (["Backspace", "Tab", "Enter", "ArrowLeft", "ArrowRight", "Delete"].includes(e.key)) return;
            if (!/^[0-9]$/.test(e.key)) e.preventDefault();
        }}
        className={className}
        aria-label={label}
    />
);

const STAT_CARDS = [
    ["autoScore", "Auto Score"],
    ["teleopScore", "Teleop Score"],
    ["totalScore", "Total Score"],
    ["climb", "Climb"],
    ["defense", "Defense Rating"],
] as const;

export const StatGrid = ({stats}: { stats: MatchStats }) => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {STAT_CARDS.map(([key, title]) => (
            <Card key={key}>
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm">{title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                    <div>
                        <p className="text-xs text-muted-foreground">Average</p>
                        <p className="text-2xl font-bold">{stats[key].avg.toFixed(1)}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t">
                        <div>
                            <p className="text-xs text-muted-foreground">Max</p>
                            <p className="text-lg font-semibold">{stats[key].max}</p>
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">Min</p>
                            <p className="text-lg font-semibold">{stats[key].min}</p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        ))}
    </div>
);

/** Report card for the team/scouter drill-downs; `by` picks which side is the title. */
export const MatchReportCard = ({entry, by, action}: { entry: MatchEntry; by: "team" | "scouter"; action: ReactNode }) => (
    <Card className="border-l-4 border-l-primary">
        <CardHeader className="pb-2">
            <CardTitle className="flex justify-between items-start gap-3">
                <span className="text-lg">{by === "team" ? `Match ${entry.matchKey.slice(-6)}` : `Team ${entry.teamNumber}`}</span>
                <div className="flex items-start gap-2">
                    <span className="text-xs bg-secondary px-2 py-1 rounded">{entry.station}</span>
                    {action}
                </div>
            </CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
            <div className="flex justify-between border-b border-border/50 pb-1">
                <span className="text-muted-foreground">{by === "team" ? "Scout:" : "Match:"}</span>
                <span className="font-medium">{by === "team" ? entry.scoutName : entry.matchKey.slice(-6)}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1">
                <div>
                    <p className="text-xs text-muted-foreground">Auto</p>
                    <p className="font-semibold">{entry.score_auto}</p>
                </div>
                <div>
                    <p className="text-xs text-muted-foreground">Teleop</p>
                    <p className="font-semibold">{entry.score_teleop}</p>
                </div>
            </div>
            <div className="pt-2 border-t space-y-1">
                {([["Total:", entry.total_score, "font-bold"], ["Climb:", entry.climb, "font-semibold"], ["Defense:", entry.defense_rating, "font-semibold"]] as const).map(([label, value, cls]) => (
                    <div key={label} className="flex justify-between">
                        <span className="text-muted-foreground">{label}</span>
                        <span className={cls}>{value}</span>
                    </div>
                ))}
            </div>
        </CardContent>
    </Card>
);

const Field = ({label, value, className = ""}: { label: string; value: ReactNode; className?: string }) => (
    <div className={`p-3 bg-muted rounded border border-border ${className}`}>
        <p className="font-semibold">{label}</p>
        <div className="text-foreground mt-1">{value}</div>
    </div>
);

const MISC_FIELDS: [keyof NonNullable<SubjectiveScoutingEntry["misc"]>, string, string?][] = [
    ["defensiveSkill", "Defensive Skill"],
    ["robotReliability", "Robot Reliability"],
    ["robotPenalties", "Robot Penalties"],
    ["autoFuel", "Auto Fuel", "half"],
    ["autoClimb", "Auto Climb", "half"],
    ["teleopPassing", "Teleop Passing"],
    ["gameSense", "Game Sense"],
    ["strengths", "Strengths"],
    ["weaknesses", "Weaknesses"],
];

const Section = ({title, className, children}: { title: string; className: string; children: ReactNode }) => (
    <div className={className}>
        <h4 className="font-semibold text-sm mb-3 text-primary">{title}</h4>
        {children}
    </div>
);

export const SubjectiveCard = ({entry, action}: { entry: SubjectiveScoutingEntry; action: ReactNode }) => {
    const {robotPerformance: rp, teamDynamics: td, tacticalInsights: ti, misc} = entry;
    return (
        <Card className="overflow-hidden border-l-4 border-l-accent">
            <CardHeader className="bg-gradient-to-r from-accent/10 to-accent/5 pb-3">
                <CardTitle className="flex justify-between items-start gap-3">
                    <div className="flex flex-col gap-1">
                        <span className="text-2xl font-bold">Team {entry.teamNumber}</span>
                        <span className="text-xs text-muted-foreground">Scout: {entry.scoutName}</span>
                    </div>
                    <div className="flex items-start gap-2">
                        <div className="bg-secondary px-3 py-1 rounded text-xs font-mono">{pstDate(entry.submittedAt)}</div>
                        {action}
                    </div>
                </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
                <Section title="Section 1: Robot Performance and Strategy" className="border-b pb-4">
                    <div className="space-y-2 text-sm">
                        <Field label="Autonomous Effectiveness" value={rp.autonomousEffectiveness || "N/A"}/>
                        <Field label="Can Quickly Score Fuels" value={rp.canQuicklyScore || "N/A"}/>
                        <Field label="Can Climb" value={<>
                            <p>{rp.canClimb || "N/A"}</p>
                            {rp.climbLevel && <p className="text-xs text-muted-foreground mt-1">Level: {rp.climbLevel}</p>}
                        </>}/>
                    </div>
                </Section>
                <Section title="Section 2: Team Dynamics" className="border-b pb-4">
                    <div className="space-y-2 text-sm">
                        <Field label="Performance Under Pressure" value={td.performanceUnderPressure || "N/A"}/>
                        <Field label="Team Focus" value={td.teamFocus || "N/A"}/>
                        <Field label="Driver Synchronization" value={td.driverSynchronization || "N/A"}/>
                    </div>
                </Section>
                <Section title="Section 3: Tactical Insights" className="">
                    <div className="space-y-2 text-sm">
                        <Field label="Defensive Strategy" value={ti.defensiveStrategy || "N/A"}/>
                        <Field label="Blocking Effectiveness" value={ti.blockingEffectiveness || "N/A"}/>
                        <Field label="Ally Cooperation" value={ti.allyCooperation || "N/A"}/>
                    </div>
                </Section>
                {misc && (
                    <Section title="Section 4: Misc" className="pt-4 border-t border-border">
                        <div className="grid grid-cols-2 gap-2 text-sm">
                            {MISC_FIELDS.map(([key, label, half]) => (
                                <Field
                                    key={key}
                                    label={label}
                                    value={misc[key] || (key === "strengths" || key === "weaknesses" ? "N/A - none found" : "N/A")}
                                    className={half ? "" : "col-span-2"}
                                />
                            ))}
                        </div>
                    </Section>
                )}
            </CardContent>
        </Card>
    );
};

const Row = ({k, v}: { k: string; v: unknown }) => (
    <div className="flex justify-between items-center py-1 px-2 bg-secondary/40 rounded">
        <span className="font-medium">{formatKey(k)}</span>
        <span className="font-semibold text-primary">{formatValue(v)}</span>
    </div>
);

const Block = ({k, v, pre}: { k: string; v: unknown; pre?: boolean }) => (
    <div className="p-3 bg-muted rounded border border-border">
        <p className="font-semibold text-foreground">{formatKey(k)}</p>
        <p className={`text-foreground mt-2 ${pre ? "whitespace-pre-wrap" : ""}`}>{formatValue(v)}</p>
    </div>
);

export const PitCard = ({entry, action}: { entry: PitScoutingEntry; action: ReactNode }) => {
    const [showJson, setShowJson] = useState(false);
    const s = categorizePitResponses(entry.responses);
    return (
        <Card className="overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-primary/10 to-primary/5 pb-3">
                <CardTitle className="flex justify-between items-start gap-3">
                    <div className="flex flex-col gap-1">
                        <span className="text-2xl font-bold">Team {entry.teamNumber}</span>
                        <span className="text-xs text-muted-foreground">Scout: {entry.scoutName}</span>
                    </div>
                    <div className="flex items-start gap-2">
                        <div className="bg-secondary px-3 py-1 rounded text-xs font-mono">{pstDate(entry.submittedAt)}</div>
                        {action}
                    </div>
                </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
                {([["Robot Functions", s.functions], ["Robot Capabilities", s.capabilities]] as const).map(([title, rows]) => rows.length > 0 && (
                    <div key={title}>
                        <h4 className="font-semibold text-sm mb-2 text-primary">{title}</h4>
                        <div className="space-y-1 text-sm">{rows.map(([k, v]) => <Row key={k} k={k} v={v}/>)}</div>
                    </div>
                ))}
                {s.autos.length > 0 && (
                    <div>
                        <h4 className="font-semibold text-sm mb-2 text-primary">Autonomous</h4>
                        <div className="space-y-2 text-sm">
                            {s.autos.map(([autoKey, autoObj]) => (
                                <div key={autoKey} className="p-2 bg-secondary/40 rounded space-y-1">
                                    <p className="font-semibold text-primary">{formatKey(autoKey)}</p>
                                    {Object.entries(autoObj).map(([subKey, subValue]) => (
                                        <div key={subKey} className="flex justify-between items-center py-1 px-2 bg-secondary/20 rounded">
                                            <span className="font-medium">{formatKey(subKey)}</span>
                                            <span className="text-primary font-semibold">
                                                {Array.isArray(subValue) ? subValue.join(", ") : String(subValue)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                {s.drivebase.length > 0 && (
                    <div>
                        <h4 className="font-semibold text-sm mb-2 text-primary">Drivebase</h4>
                        <div className="space-y-2 text-sm">{s.drivebase.map(([k, v]) => <Block key={k} k={k} v={v}/>)}</div>
                    </div>
                )}
                {s.notes.length > 0 && (
                    <div className="pt-2 border-t border-border">
                        <h4 className="font-semibold text-sm mb-2 text-primary">Strategy & Notes</h4>
                        <div className="space-y-2 text-sm">{s.notes.map(([k, v]) => <Block key={k} k={k} v={v} pre/>)}</div>
                    </div>
                )}
                <div className="pt-4 border-t border-border">
                    <button
                        className="px-2 py-1 text-xs bg-primary text-white rounded hover:bg-primary/80"
                        onClick={() => setShowJson(!showJson)}
                    >
                        {showJson ? "Hide JSON Dump" : "Show JSON Dump"}
                    </button>
                    {showJson && (
                        <pre className="mt-2 text-xs bg-black/80 text-foreground p-3 rounded overflow-x-auto whitespace-pre-wrap">
                            {JSON.stringify(entry, null, 2)}
                        </pre>
                    )}
                </div>
            </CardContent>
        </Card>
    );
};
