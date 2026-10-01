"""Generate cover-art variants into public/covers/<theme>-<n>.jpg via Gemini image on Vertex AI.

Usage: python3 scripts/generate_covers.py [--force]
Requires `gcloud auth print-access-token` to work for project desidhun.
"""
import base64
import json
import subprocess
import sys
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

PROJECT = "desidhun"
MODEL = "gemini-2.5-flash-image"
OUT = Path(__file__).resolve().parent.parent / "public" / "covers"
SUFFIX = (
    " Square 1:1 album cover art, modern and striking, high detail."
    " Absolutely no text, letters, numbers, logos, signatures, or watermarks."
)

PROMPTS = {
    "monsoon": [
        "Glossy 3D render of translucent glass raindrops falling over a teal and violet gradient, soft studio lighting",
        "Risograph print of a Mumbai street in heavy monsoon rain, yellow umbrellas, pink and blue ink overlap, grain",
        "Layered paper-cut diorama of storm clouds, lightning and rain over green paddy fields, deep indigo and emerald",
        "Cinematic photograph of rain on a window at night with blurred warm city bokeh, moody teal and amber grading",
    ],
    "romantic": [
        "Dreamy double exposure of two silhouettes and a full moon over a lake, rose gold and midnight blue",
        "Minimal flat vector of two paper boats touching on a pink sunset sea, pastel gradient, clean shapes",
        "Soft-focus film photograph of marigold petals and fairy lights on a balcony at dusk, warm peach tones",
        "Glassmorphism abstract of two overlapping glowing hearts made of frosted glass, magenta and lilac gradient",
    ],
    "sufi": [
        "Motion-blur long exposure of a whirling dervish in white robes, swirling golden light trails, dark background",
        "Intricate geometric Islamic tile pattern rendered as gold foil on deep emerald velvet, symmetrical",
        "Surreal desert at night with a lone lantern and spiralling stars, indigo and saffron, painterly digital art",
        "Abstract ink wash of flowing crimson fabric forming a spiral, on cream paper texture, minimal and spiritual",
    ],
    "ghazal": [
        "Moody still life of a brass oil lamp, a rose and an open diary on dark wood, chiaroscuro lighting",
        "Art deco illustration of a crescent moon over Mughal arches, navy and champagne gold, elegant linework",
        "Cinematic close-up of smoke curling from an incense stick in a dark room, a single ray of amber light",
        "Watercolor of rain-soaked jasmine flowers on a windowsill at night, deep blue with soft white highlights",
    ],
    "bhajan": [
        "Serene 3D render of a glowing diya floating on a river at dawn, soft pink sky, reflections, calm",
        "Contemporary flat illustration of a peacock feather and flute, turquoise and gold, clean vector shapes",
        "Photograph of hundreds of oil lamps on temple ghat steps at twilight, warm orange bokeh",
        "Mandala of lotus petals in saffron, magenta and gold, radial symmetry, modern digital art with depth",
    ],
    "folk": [
        "Modern reinterpretation of Madhubani art with bold outlines of birds and fish, vibrant red, yellow and black",
        "Rajasthani desert caravan at golden hour, camels silhouetted, dusty orange haze, cinematic photograph",
        "Colourful block-print textile pattern of dancers and drums, indigo and madder red, handmade texture",
        "Punjabi mustard fields with a tractor under a big blue sky, bright saturated flat illustration, playful",
    ],
    "celebration": [
        "Explosion of coloured Holi powder in mid-air against black, high-speed photography, vivid pink, green and yellow",
        "Sparklers and string lights at a night wedding, shallow depth of field, gold and magenta bokeh",
        "Maximalist collage of marigold garlands, dhol drums and confetti, pop-art colours, halftone accents",
        "Isometric 3D scene of a festive rooftop party with lanterns and fireworks, cute stylised render",
    ],
    "classical": [
        "Macro photograph of sitar strings and carved wooden frets, dramatic side light, warm brown and gold",
        "Bauhaus abstract composition of circles and arcs suggesting a tanpura, mustard, rust and teal",
        "Minimal line art of a tabla pair on off-white, single continuous gold line, lots of negative space",
        "Oil-painting style concert hall stage with a single spotlight on a veena, deep burgundy curtains",
    ],
    "neon": [
        "Synthwave grid landscape with a huge magenta sun and chrome palm trees, retro 80s glow",
        "Y2K liquid chrome blob sculpture reflecting neon pink and cyan lights, glossy 3D render",
        "Laser beams slicing through fog in a club, electric blue and hot pink, long exposure photograph",
        "Abstract glitch art of a sound waveform, RGB split, scanlines, deep black background",
    ],
    "urban": [
        "Graffiti-covered alley at night with a lone streetlight and wet asphalt reflections, gritty photo",
        "Brutalist concrete towers against a burnt-orange sky, strong geometric shadows, editorial photograph",
        "Bold street-art sticker collage of boomboxes, sneakers and crowns, flat colours, thick outlines",
        "Lo-fi anime-style bedroom at night with city lights through the window and a cat, cosy purple tones",
    ],
    "studio": [
        "Close-up of a vintage broadcast microphone with warm rim light on a charcoal background, sharp detail",
        "Minimal 3D render of soft foam sound panels in pastel colours with a floating headphone, clean studio",
        "Retro reel-to-reel tape machine in a dim studio, amber VU meters glowing, analogue warmth",
        "Abstract audio waveform made of glowing threads on deep navy, elegant and modern",
    ],
    "cinematic": [
        "Film noir hero silhouette in a doorway with backlit smoke, high contrast black and gold",
        "Epic wide shot of a lone figure on a cliff at sunset with dust and lens flare, blockbuster colour grade",
        "Vintage cinema projector beam cutting through dark hall, dust particles glowing, teal and orange",
        "Split-lit dramatic portrait silhouette with rain and red neon, thriller poster mood, no face detail",
    ],
}


def token() -> str:
    return subprocess.check_output(["gcloud", "auth", "print-access-token"], text=True).strip()


def generate(job: tuple[str, int, str], access_token: str, force: bool) -> str:
    theme, index, prompt = job
    target = OUT / f"{theme}-{index}.jpg"
    if target.exists() and not force:
        return f"skip {target.name}"
    url = (
        f"https://aiplatform.googleapis.com/v1/projects/{PROJECT}/locations/global/"
        f"publishers/google/models/{MODEL}:generateContent"
    )
    body = json.dumps({
        "contents": [{"role": "user", "parts": [{"text": prompt + "." + SUFFIX}]}],
        "generationConfig": {"responseModalities": ["IMAGE"], "imageConfig": {"aspectRatio": "1:1"}},
    }).encode()
    for attempt in range(8):
        if attempt:
            time.sleep(min(60, 8 * attempt))
        try:
            request = urllib.request.Request(url, data=body, headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json",
            })
            with urllib.request.urlopen(request, timeout=120) as response:
                payload = json.load(response)
            parts = payload["candidates"][0]["content"]["parts"]
            data = next(part["inlineData"]["data"] for part in parts if "inlineData" in part)
            raw = target.with_suffix(".raw")
            raw.write_bytes(base64.b64decode(data))
            subprocess.run(
                ["sips", "-s", "format", "jpeg", "-s", "formatOptions", "82", "-Z", "1024", str(raw), "--out", str(target)],
                check=True, capture_output=True,
            )
            raw.unlink()
            return f"ok   {target.name}"
        except Exception as error:  # noqa: BLE001
            last = error
    return f"FAIL {target.name}: {last}"


def main() -> None:
    force = "--force" in sys.argv
    access_token = token()
    jobs = [(theme, i + 2, prompt) for theme, prompts in PROMPTS.items() for i, prompt in enumerate(prompts)]
    with ThreadPoolExecutor(max_workers=2) as pool:
        for line in pool.map(lambda job: generate(job, access_token, force), jobs):
            print(line, flush=True)


if __name__ == "__main__":
    main()
