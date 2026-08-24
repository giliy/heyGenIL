#!/usr/bin/env bash
# gen_images.sh — the 8 storybook stills for short-19-kamatz-gan.
# Every image drives from the LOCKED Bu reference (character.jpg) — never regenerate him from text.
# fast tier, 9:16, 2K. Run from the repo root:  bash shorts/short-19-kamatz-gan/gen_images.sh
set -e
PY=".venv-image312/Scripts/python.exe tools/gen_image.py --ref ai-shorts/bu-koala/character.jpg --model fast --aspect 9:16 --size 2K"
OUT="media/projects/short-19-kamatz-gan"

# The locked Bu design line (verbatim design tokens so the model keeps him on-model).
BU="this exact cute yellow koala creature, big fluffy round ears with cream inner fluff, soft plush body, huge dark glossy eyes, gentle smile, chubby cheeks, mitten paws"
# A grown-up koala FATHER (אַבָּא) — same locked koala family as Bu, clearly bigger and warm,
# NOT a human (no dad reference exists in the library; this stays on-model without touching Bu's lock).
DAD="a grown-up koala father, the same species as the little yellow koala but noticeably bigger and taller with a gentle warm smile, the same big fluffy round ears, soft amber-yellow fur"
STYLE="soft warm watercolor storybook illustration for a Hebrew children's short, gentle sunny palette, thick soft shapes, calm premium Bluey-like warmth, no text, no words, vertical 9:16 composition with the subject centered and clear space at the bottom for captions"

$PY --out "$OUT/b0-hook.png"       --prompt "$BU waving hello beside a big soft glowing yellow kamatz vowel sign floating like a friendly star, in a sunny green park, $STYLE"
$PY --out "$OUT/b1-walk.png"       --prompt "$BU strolling happily into a lush green park while holding hands with $DAD, trees and a winding path, $STYLE"
$PY --out "$OUT/b2-rabbit.png"     --prompt "$BU watching a small brown rabbit hop between tall green grass tufts in a sunny park, delighted curious expression, $STYLE"
$PY --out "$OUT/b3-aron.png"       --prompt "$BU opening a tiny wooden bookcase on a park post, glowing colorful little books inside, magical warm light, $STYLE"
$PY --out "$OUT/b4-watermelon.png" --prompt "$DAD pulling a big red watermelon out of a wicker picnic basket while $BU claps excitedly, sunny park picnic blanket, $STYLE"
$PY --out "$OUT/b5-red.png"        --prompt "a glossy juicy red watermelon slice close-up with sparkling juice drops, warm picnic background softly blurred, $STYLE"
$PY --out "$OUT/b6-recap.png"      --prompt "$BU beaming proudly with both arms raised, the glowing yellow kamatz sign floating above like a gold star, confetti-soft park bokeh, $STYLE"
$PY --out "$OUT/b7-keywords.png"   --prompt "$BU sitting happily in the center of a sunny park surrounded by five small friendly objects in a gentle arc: $DAD standing small, a small brown rabbit, a little wooden bookcase, a red watermelon, and a shiny red apple, $STYLE"

echo "done -> $OUT"
