import type { Collectible, CollectibleKind } from "./types";

export const WALL_PASS_ROOMS = Object.freeze([0, 9, 90, 99]);
export const GHOST_EAT_ROOMS = Object.freeze([22, 27, 72, 77]);

export function productionCollectibles(
  roomCount = 100,
): readonly Collectible[] {
  if (roomCount !== 100)
    throw new Error(
      "The Quantman slice collectible layout requires exactly 100 rooms.",
    );
  const wallPass = new Set(WALL_PASS_ROOMS);
  const ghostEat = new Set(GHOST_EAT_ROOMS);
  return Object.freeze(
    Array.from({ length: roomCount }, (_, room) =>
      Object.freeze({
        room,
        kind: wallPass.has(room)
          ? "wall-pass"
          : ghostEat.has(room)
            ? "ghost-eat"
            : "pellet",
      } satisfies Collectible),
    ),
  );
}

export function collectibleLayoutFromKinds(
  kinds: readonly CollectibleKind[],
): readonly Collectible[] {
  if (kinds.length !== 100)
    throw new Error(
      "A test collectible layout must still contain one collectible in every room.",
    );
  return Object.freeze(
    kinds.map((kind, room) => Object.freeze({ room, kind })),
  );
}
