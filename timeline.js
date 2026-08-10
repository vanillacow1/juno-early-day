const SUPABASE_URL = "https://mfxqteusxgzheuxotnme.supabase.co";
const SUPABASE_ANON_PUBLIC_KEY =
  "sb_publishable_q--3XcghfQJRGQ32B8vbmw_1MufvZZd";
const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_PUBLIC_KEY
);
const timeline = document.getElementById("timeline");

// Let a regular mouse wheel browse the horizontal timeline.
timeline.addEventListener(
  "wheel",
  (event) => {
    if (timeline.scrollWidth <= timeline.clientWidth) return;

    const multiplier = event.deltaMode === 1 ? 18 : 1;
    const wheelAmount = event.deltaY || event.deltaX;
    event.preventDefault();
    timeline.scrollBy({ left: wheelAmount * multiplier, top: 0 });
  },
  { passive: false }
);

function formatDate(value) {
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function createTimelineItem(photo) {
  const item = document.createElement("article");
  item.className = "timeline-item";
  const date = document.createElement("time");
  date.className = "timeline-date";
  date.dateTime = photo.created_at;
  date.textContent = formatDate(photo.created_at);
  const card = document.createElement("div");
  card.className = "timeline-card";
  const image = document.createElement("img");
  image.src = photo.image_url;
  image.alt = photo.caption ? `Juno — ${photo.caption}` : "Photo of Juno";
  image.loading = "lazy";
  const details = document.createElement("div");
  details.className = "timeline-details";
  details.append(date);
  if (photo.caption) {
    const caption = document.createElement("p");
    caption.className = "timeline-caption";
    caption.textContent = photo.caption;
    details.appendChild(caption);
  }
  card.append(image, details);
  item.append(card);
  window.createReactionBar(photo.id).then((reactionBar) => {
    details.appendChild(reactionBar);
  });
  return item;
}

function renderTimeline(photos) {
  timeline.innerHTML = "";
  timeline.classList.toggle(
    "is-single-item",
    Boolean(photos && photos.length === 1)
  );
  if (!photos || photos.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-feed-message";
    empty.textContent =
      "No memories yet — Juno's timeline will appear here as photos are added.";
    timeline.appendChild(empty);
    return;
  }
  photos.forEach((photo) => timeline.appendChild(createTimelineItem(photo)));
}

async function loadTimeline() {
  const { data, error } = await supabaseClient
    .from("photos")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) {
    console.error("Error loading timeline:", error);
    timeline.innerHTML =
      "<p class=\"empty-feed-message\">We couldn't load Juno's timeline just now. Please try again soon.</p>";
    return;
  }
  renderTimeline(data);
}

supabaseClient
  .channel("timeline-realtime")
  .on(
    "postgres_changes",
    { event: "*", schema: "public", table: "photos" },
    loadTimeline
  )
  .subscribe();
loadTimeline();
