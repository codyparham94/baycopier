// Settings page interaction details: pointer sheen on cards, secret reveal.
(() => {
  for (const card of document.querySelectorAll(".card")) {
    card.addEventListener("pointermove", (e) => {
      const r = card.getBoundingClientRect();
      card.style.setProperty("--mx", `${e.clientX - r.left}px`);
      card.style.setProperty("--my", `${e.clientY - r.top}px`);
    });
  }

  const secret = document.getElementById("clientSecret");
  const reveal = document.getElementById("toggle-secret");
  reveal.addEventListener("click", () => {
    const show = secret.type === "password";
    secret.type = show ? "text" : "password";
    reveal.textContent = show ? "Hide" : "Show";
    reveal.setAttribute("aria-pressed", String(show));
    reveal.setAttribute("aria-label", show ? "Hide secret" : "Show secret");
  });
})();
