const highlights = [
  {
    title: "Everyday conversation",
    body: "Faith, family, careers, business, sports, entertainment and daily life, guided by Christian values.",
  },
  {
    title: "Churches and communities",
    body: "Verified church and ministry pages, plus public and private communities around shared interests.",
  },
  {
    title: "Friends you trust",
    body: "Follow people and organisations, form mutual friendships and message friends privately.",
  },
];

export default function LandingPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-12 md:py-20">
      <h1 className="max-w-2xl text-4xl font-bold tracking-tight md:text-5xl">
        A welcoming place to connect, built on Christian values.
      </h1>
      <p className="mt-4 max-w-2xl text-lg text-muted">
        BELUNAI is a social network for Nigeria, for ordinary conversation, trusted
        church identities and the people who matter to you.
      </p>
      <p
        role="status"
        className="mt-8 max-w-2xl rounded-xl border border-border bg-surface p-4"
      >
        BELUNAI is still being built. Sign-up opens with the pilot.
      </p>
      <ul className="mt-12 grid gap-4 md:grid-cols-3">
        {highlights.map((item) => (
          <li key={item.title} className="rounded-xl border border-border bg-surface p-6">
            <h2 className="text-lg font-semibold">{item.title}</h2>
            <p className="mt-2 text-muted">{item.body}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
