// Small helpers every goal screen shares: the goal as the money code sees it, its short name, its 3D object.
import type { GoalLite } from '@/lib/goals';
import type { HomeGoal } from '@/lib/home';
import { goalIcon3D, goalTypeIcon3D } from '@/lib/icons3d';
import { shortName } from '@/lib/setup/plan';

export const liteOf = (g: HomeGoal): GoalLite => ({ id: g.id, kind: g.kind, target: g.target, saved: g.saved, due: g.due, monthly: g.monthly });
export const nameOf = (g: { title: string; kind: string }) => (g.kind === 'monthly' ? g.title : shortName(g.title, g.kind as never));
export const iconOf = (g: { goalType: string | null; kind: string }) => (g.goalType ? goalTypeIcon3D(g.goalType) : goalIcon3D(g.kind));
