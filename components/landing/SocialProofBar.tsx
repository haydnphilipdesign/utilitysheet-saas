const customerTestimonials = [
  {
    quote:
      "Before UtilitySheet, we sent blank forms to homeowners through Dotloop or DocuSign, and they rarely came back completed. Now we send one seller link from a templated email, get notified when it is complete, download the finished sheet, and we are done.",
    name: "Kaylin Nunn",
    role: "Owner & Director of Transaction Coordination, Precision Leverage Solutions",
  },
  {
    quote:
      "UtilitySheet has made obtaining utility information much easier. Before, we sent emails asking for the info and tried to track down utility companies last minute. Now we keep the email simple, send sellers the UtilitySheet link, and the completion rate has been pretty dang good.",
    name: "Courtney Bownes",
    role: "Owner | Lead Transaction Manager, FastForward Transaction Management",
  },
  {
    quote:
      "Before UtilitySheet, I used a Google spreadsheet with local providers and copied information into emails. UtilitySheet makes it easy for the co-op agent to send the form to the seller, and the completed branded PDF helps level up my TC company's service.",
    name: "Agatha Aquilia",
    role: "Transaction Manager, Aquilia Associates",
  },
];

export function SocialProofBar() {
  return (
    <section className="marketing-testimonials marketing-section">
      <div className="marketing-container">
        <p className="marketing-eyebrow">FROM THE PEOPLE DOING THE WORK</p>
        <h2>
          A little less chasing.
          <br />A lot more peace of mind.
        </h2>
        <div className="testimonial-grid">
          {customerTestimonials.map(({ quote, name, role }) => (
            <figure key={name}>
              <blockquote>&ldquo;{quote}&rdquo;</blockquote>
              <figcaption>
                <strong>{name}</strong>
                <span>{role}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
