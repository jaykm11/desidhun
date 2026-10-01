const MODELS = [
  {
    name: 'Gemini 2.0 Flash',
    detail: 'Creates lyrics, analyzes inputs, and develops song prompts. Gemini 2.5 Flash-Lite is available as a fallback when needed.',
  },
  {
    name: 'Lyria 3.5',
    detail: 'Generates full music tracks from the selected lyrics and style prompt. Vertex AI Lyria 3 Pro Preview is used as a fallback.',
  },
  {
    name: 'Chirp 3 HD',
    detail: 'Produces spoken-vocal narration in Hindi or English, including Dialogue / Punchline delivery when that composition type is selected.',
  },
];

export default function AboutPage() {
  return (
    <main className="legal-page about-page">
      <p className="workflow-step">YSCHOAR TECHNOLOGY LLP</p>
      <h1>About Desi Dhun</h1>
      <p className="about-lead">Desi Dhun is Yschoar&apos;s flagship project: an AI music studio built for turning ideas, lyrics, and raga-inspired direction into original songs.</p>
      <section>
        <h2>Latest AI models</h2>
        <p>Desi Dhun uses Google&apos;s current generative models across prompt creation, music generation, and spoken vocal narration.</p>
        <dl className="about-models">
          {MODELS.map((model) => (
            <div key={model.name}>
              <dt>{model.name}</dt>
              <dd>{model.detail}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section>
        <h2>From idea to song</h2>
        <p>Start with your own lyrics or a creative direction. Desi Dhun develops the prompt, lets you refine it, then renders a song while preserving your selected vocal, instrument, tempo, and arrangement choices.</p>
      </section>
    </main>
  );
}
