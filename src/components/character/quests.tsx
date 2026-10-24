import Link from "next/link";
import type { ReactNode } from "react";
import {
  BriefcaseIcon,
  CheckIcon,
  FileTextIcon,
  FlameIcon,
  GraduationCapIcon,
  MicIcon,
  SproutIcon,
  TrophyIcon,
  ZapIcon,
  type LucideIcon,
} from "lucide-react";
import type { CharacterState } from "@/lib/gamification/server";
import type { MilestoneId } from "@/lib/gamification/milestones";
import { INTERVIEW_BONUS_MIN_SCORE, XP_REWARDS } from "@/lib/gamification/xp";
import { cn } from "@/lib/utils";
import { ClaimMilestoneButton } from "./claim-milestone-button";

const MILESTONE_ICONS: Record<MilestoneId, LucideIcon> = {
  bachelor: GraduationCapIcon,
  master: GraduationCapIcon,
  spring_week: SproutIcon,
  internship: BriefcaseIcon,
  full_time_offer: TrophyIcon,
};

const scoreFormat = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 });

type QuestCardProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  reward: string;
  done?: boolean;
  /** Status line or action at the bottom. */
  footer: ReactNode;
};

function QuestCard({ icon: Icon, title, description, reward, done, footer }: QuestCardProps) {
  return (
    <li
      className={cn(
        "flex flex-col gap-2 rounded-lg border bg-card p-4",
        done && "border-positive/40 bg-positive/5",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex size-9 items-center justify-center rounded-md bg-muted">
          <Icon className="size-4.5" aria-hidden />
        </div>
        <span className="text-xs font-semibold text-muted-foreground">{reward}</span>
      </div>
      <p className="font-semibold">{title}</p>
      <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>
      <div className="mt-auto pt-1 text-xs">{footer}</div>
    </li>
  );
}

function Done({ children = "Abgeschlossen" }: { children?: ReactNode }) {
  return (
    <span className="flex items-center gap-1 font-semibold text-positive">
      <CheckIcon className="size-3.5" aria-hidden />
      {children}
    </span>
  );
}

function GoTo({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="font-medium underline underline-offset-2">
      {children}
    </Link>
  );
}

/** CV milestones and recurring activities that earn XP. Nothing here awards XP directly. */
export function Quests({ state }: { state: CharacterState }) {
  const { milestones, counts, streak } = state;
  return (
    <section className="flex flex-col gap-6" aria-labelledby="quests-title">
      <h2 id="quests-title" className="text-xl font-semibold tracking-tight">
        Deine Quests
      </h2>

      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-muted-foreground">CV-Meilensteine</h3>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {milestones.map((m) => (
            <QuestCard
              key={m.id}
              icon={MILESTONE_ICONS[m.id]}
              title={m.title}
              description={m.description}
              reward={`+${m.xp} XP`}
              done={m.reached}
              footer={
                m.reached ? (
                  <Done />
                ) : m.source === "claim" ? (
                  <ClaimMilestoneButton id={m.id} title={m.title} xp={m.xp} />
                ) : (
                  <GoTo href="/profile">Im Profil eintragen</GoTo>
                )
              }
            />
          ))}
        </ul>
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-muted-foreground">Training</h3>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <QuestCard
            icon={MicIcon}
            title="Mock-Interview"
            description={`${XP_REWARDS.interviewFinished} XP pro Interview, dazu ${XP_REWARDS.feedbackScorePerPoint} XP je Punkt im Feedback-Score.`}
            reward={`+${XP_REWARDS.interviewFinished} XP`}
            footer={
              <span className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">{counts.interviews} abgeschlossen</span>
                <GoTo href="/interviews">Interview starten</GoTo>
              </span>
            }
          />
          <QuestCard
            icon={ZapIcon}
            title="Stark-Bonus"
            description={`Bonus, wenn ein Interview im Feedback über ${scoreFormat.format(INTERVIEW_BONUS_MIN_SCORE)} von 5 Punkten liegt.`}
            reward={`+${XP_REWARDS.interviewBonus} XP`}
            done={counts.interviewBonuses > 0}
            footer={
              counts.interviewBonuses > 0 ? (
                <Done>{counts.interviewBonuses}× erreicht</Done>
              ) : (
                <span className="text-muted-foreground">Noch nicht erreicht</span>
              )
            }
          />
          <QuestCard
            icon={FlameIcon}
            title="Tägliche Streak"
            description="Jeder Tag, an dem du XP sammelst, zählt automatisch."
            reward={`+${XP_REWARDS.dailyStreak} XP / Tag`}
            done={streak.activeToday}
            footer={
              streak.activeToday ? (
                <Done>Heute dabei</Done>
              ) : (
                <span className="text-muted-foreground">Heute noch offen</span>
              )
            }
          />
          <QuestCard
            icon={FileTextIcon}
            title="Lebenslauf zuschneiden"
            description="Ein Lebenslauf, zugeschnitten auf eine Stelle."
            reward={`+${XP_REWARDS.resumeTailored} XP`}
            footer={
              <span className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">{counts.resumesTailored} erstellt</span>
                <GoTo href="/resume">Zum Lebenslauf</GoTo>
              </span>
            }
          />
        </ul>
      </div>
    </section>
  );
}
