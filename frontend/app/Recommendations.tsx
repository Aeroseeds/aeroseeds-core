interface TreatmentSource {
  title: string;
  url: string;
}

interface RecommendationsProps {
  recommendations?: string[];
  sources?: TreatmentSource[];
}

// Fixed safety caveat, always shown alongside any product advice. Kept here
// (not model-generated) so it can never be omitted or reworded by the model.
const SAFETY_CAVEAT =
  "Always confirm a product is NAFDAC-registered and check with a local " +
  "agro-dealer or agricultural extension officer before buying or applying. " +
  "Follow the product label for dosage, timing, and safety precautions.";

export default function Recommendations({
  recommendations,
  sources,
}: RecommendationsProps) {
  if (!recommendations || recommendations.length === 0) return null;

  return (
    <div className="result-section result-reco">
      <p className="result-label">What to use</p>
      <ul className="result-reco-list">
        {recommendations.map((rec, i) => (
          <li key={i}>{rec}</li>
        ))}
      </ul>
      <p className="result-caveat">{SAFETY_CAVEAT}</p>
      {sources && sources.length > 0 && (
        <div className="result-sources">
          <p className="result-sources-label">Sources</p>
          {sources.map((s, i) => (
            <a
              key={i}
              className="result-source-link"
              href={s.url}
              target="_blank"
              rel="noreferrer"
            >
              {s.title || s.url}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
