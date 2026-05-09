export function makeSongId(artist, title) {
  return `${(artist || "").trim().toLowerCase()}::${(title || "").trim().toLowerCase()}`;
}

export function esc(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function applyRating({ thumbsUp, thumbsDown, myVote }, { btnUp, btnDown, countUp, countDown }) {
  countUp.textContent   = thumbsUp;
  countDown.textContent = thumbsDown;
  btnUp.classList.toggle("voted-up",    myVote === "up");
  btnDown.classList.toggle("voted-down", myVote === "down");
  btnUp.disabled   = false;
  btnDown.disabled = false;
}
