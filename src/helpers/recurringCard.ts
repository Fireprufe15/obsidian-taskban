import update from 'immutability-helper';
import { StateManager } from 'src/StateManager';
import { Board, Item, Lane } from 'src/components/types';

export const RECURRING_WORDS = ['WEEKLY', 'MONTHLY', 'DAILY'] as const;
export type RecurringWord = (typeof RECURRING_WORDS)[number];

export function cleanMarkdownFormatting(str: string): string {
  return str.replace(/^(?:\*{1,2}|_{1,2})|(?:(?:\*{1,2}|_{1,2})$)/g, '').trim();
}

export function getRecurringWord(titleRaw: string): RecurringWord | null {
  if (!titleRaw) return null;
  const match = titleRaw
    .trimStart()
    .match(/^(?:\*{1,2}|_{1,2})?(WEEKLY|MONTHLY|DAILY)(?:\*{1,2}|_{1,2})?(?:[:\s-]|$)/i);

  return match ? (match[1].toUpperCase() as RecurringWord) : null;
}

export function findMatchingRecurringLane(
  board: Board,
  recurringWord: string
): { lane: Lane; laneIndex: number } | null {
  const targetWord = recurringWord.trim().toUpperCase();

  // Find lane whose cleaned title matches the recurring word (case-insensitive)
  const laneIndex = board.children.findIndex(
    (lane) => cleanMarkdownFormatting(lane.data.title).toUpperCase() === targetWord
  );

  if (laneIndex === -1) {
    return null;
  }

  return { lane: board.children[laneIndex], laneIndex };
}

export function cleanCompletedTaskText(titleRaw: string): string {
  let clean = titleRaw;

  // Remove Tasks plugin completion date: ✅ YYYY-MM-DD
  clean = clean.replace(/✅ *\d{4}-\d{2}-\d{2}/u, '');

  // Remove Dataview inline completion field: [completion:: ...] or (completion:: ...)
  clean = clean
    .replace(/\[completion::[^\]]*\]/g, '')
    .replace(/\(completion::[^)]*\)/g, '');

  return clean.replace(/ {2,}/g, ' ').trim();
}

export function createUnfinishedCopy(item: Item, stateManager: StateManager): Item {
  const cleanTitle = cleanCompletedTaskText(item.data.titleRaw);
  const copy = stateManager.getNewItem(cleanTitle, ' ');

  copy.data.checked = false;
  copy.data.checkChar = ' ';

  return copy;
}

export function handleRecurringCard(
  board: Board,
  item: Item,
  stateManager: StateManager
): Board {
  const recurringWord = getRecurringWord(item.data.titleRaw);
  if (!recurringWord) {
    return board;
  }

  const match = findMatchingRecurringLane(board, recurringWord);
  if (!match) {
    return board;
  }

  const copy = createUnfinishedCopy(item, stateManager);
  const insertionMethod = stateManager.getSetting('new-card-insertion-method');
  const shouldPrepend = insertionMethod === 'prepend' || insertionMethod === 'prepend-compact';

  const targetLane = board.children[match.laneIndex];
  const laneMutation: any = {
    children: shouldPrepend ? { $unshift: [copy] } : { $push: [copy] },
  };

  if (targetLane.data?.sorted !== undefined) {
    laneMutation.data = { $unset: ['sorted'] };
  }

  return update(board, {
    children: {
      [match.laneIndex]: laneMutation,
    },
  });
}
