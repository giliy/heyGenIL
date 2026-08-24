# Sonniss GDC Game Audio Bundle — license summary (provenance copy)

Source: https://sonniss.com/gameaudiogdc/ and https://sonniss.com/gdc-bundle-license/
This is a saved summary for provenance; the authoritative text lives on sonniss.com.

**What you may do**
- Use the sounds royalty-free and commercially, in games, film, TV, podcasts, YouTube,
  TikTok, VR/AR, apps, ads and trailers.
- No attribution required.
- Unlimited number of projects, for the rest of your lifetime; license does not expire.
- Editing / layering / processing the sounds is allowed.

**What you may NOT do**
- Resell or redistribute the raw/standalone files, or bundle them into a sound-effects library.
  → This is why Sonniss clips live in the GITIGNORED `media/library/sfx/pro/` dir and are
    fetched per-machine by `tools/fetch_pro_sfx.py` instead of being committed to this repo.
- Use the sounds for AI/ML training (strictly prohibited). Do not feed them to any model.

Embedding the sounds in a finished, rendered video is fully licensed. Committing the raw audio
to a distributed repository is not — keep `pro/` out of git.
