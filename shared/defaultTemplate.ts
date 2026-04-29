import type { CodingTemplate, MatchPhase } from "./domain.js";

const now = "2026-04-29T00:00:00.000Z";

const phaseColor: Record<MatchPhase, string> = {
  attack: "#4ade80",
  defense: "#3b82f6",
  transition: "#f59e0b",
  set_piece: "#a855f7",
};

export function createDefaultFootballTemplate(projectId: string): CodingTemplate {
  void projectId;

  return {
    id: "football-default-v1",
    name: "默认足球 Coding 模板",
    sport: "football",
    version: 1,
    createdAt: now,
    updatedAt: now,
    groups: [
      {
        id: "attack",
        name: "进攻",
        color: phaseColor.attack,
        phase: "attack",
        buttons: [
          button("attack-build-up", "进攻组织", "build_up", "attack", "1"),
          button("attack-progress", "推进", "progression", "attack", "2"),
          button("attack-cross", "传中", "cross", "attack", "3"),
          button("attack-shot", "射门", "shot", "attack", "4"),
          button("attack-final-third", "进攻三区", "final_third_entry", "attack", "5"),
          button("attack-counter", "反击", "counter_attack", "attack", "6"),
        ],
      },
      {
        id: "defense",
        name: "防守",
        color: phaseColor.defense,
        phase: "defense",
        buttons: [
          button("defense-press", "压迫", "pressing", "defense", "Q"),
          button("defense-regain", "抢断", "regain", "defense", "W"),
          button("defense-intercept", "拦截", "interception", "defense", "E"),
          button("defense-clearance", "解围", "clearance", "defense", "R"),
          button("defense-bypass", "被突破", "bypassed", "defense", "T"),
          button("defense-concede", "丢球", "goal_conceded", "defense", "Y"),
        ],
      },
      {
        id: "transition",
        name: "转换",
        color: phaseColor.transition,
        phase: "transition",
        buttons: [
          button("transition-attack-defense", "由攻转守", "attack_to_defense", "transition", "A"),
          button("transition-defense-attack", "由守转攻", "defense_to_attack", "transition", "S"),
          button("transition-counterpress", "快速反抢", "counterpress", "transition", "D"),
          button("transition-second-ball", "二点球", "second_ball", "transition", "F"),
        ],
      },
      {
        id: "set-piece",
        name: "定位球",
        color: phaseColor.set_piece,
        phase: "set_piece",
        buttons: [
          button("set-piece-corner", "角球", "corner", "set_piece", "Z"),
          button("set-piece-free-kick", "任意球", "free_kick", "set_piece", "X"),
          button("set-piece-throw", "界外球", "throw_in", "set_piece", "C"),
          button("set-piece-penalty", "点球", "penalty", "set_piece", "V"),
          button("set-piece-defense", "定位球防守", "set_piece_defense", "set_piece", "B"),
        ],
      },
    ],
  };
}

function button(
  id: string,
  label: string,
  eventType: string,
  phase: MatchPhase,
  hotkey: string,
) {
  return {
    id,
    label,
    eventType,
    phase,
    hotkey,
    color: phaseColor[phase],
    defaultDurationMs: 10_000,
  };
}
