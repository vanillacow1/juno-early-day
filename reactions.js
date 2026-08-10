const REACTIONS_URL = "https://mfxqteusxgzheuxotnme.supabase.co";
const REACTIONS_KEY = "sb_publishable_q--3XcghfQJRGQ32B8vbmw_1MufvZZd";
const REACTIONS_TABLE = "photo_reactions";
const EMOJIS = ["❤️", "🥹", "😍", "✨", "🎉", "😴", "🥰", "😂", "😭", "👏"];
const reactionsClient = window.supabase.createClient(
  REACTIONS_URL,
  REACTIONS_KEY
);

function getVisitorId() {
  const storageKey = "juno-reactions-visitor";
  let visitorId = localStorage.getItem(storageKey);
  if (!visitorId) {
    visitorId = crypto.randomUUID();
    localStorage.setItem(storageKey, visitorId);
  }
  return visitorId;
}

function updateButton(button, emoji, count, selected) {
  button.classList.toggle("is-selected", selected);
  button.setAttribute("aria-pressed", String(selected));
  button.setAttribute(
    "aria-label",
    selected ? `Remove ${emoji} reaction` : `React with ${emoji}`
  );
  button.textContent = `${emoji} ${count}`;
}

window.createReactionBar = async function createReactionBar(photoId) {
  const bar = document.createElement("div");
  bar.className = "reaction-bar";
  bar.setAttribute("aria-label", "Reactions");

  const { data, error } = await reactionsClient
    .from(REACTIONS_TABLE)
    .select("emoji, visitor_id")
    .eq("photo_id", photoId);

  const visitorId = getVisitorId();
  const counts = Object.fromEntries(EMOJIS.map((emoji) => [emoji, 0]));
  let selectedEmoji = null;
  if (!error) {
    data.forEach((reaction) => {
      if (reaction.emoji in counts) counts[reaction.emoji] += 1;
      if (reaction.visitor_id === visitorId) selectedEmoji = reaction.emoji;
    });
  } else {
    console.error("Couldn't load reactions:", error);
  }

  const buttons = new Map();
  const refreshButtons = () => {
    EMOJIS.forEach((emoji) => {
      updateButton(
        buttons.get(emoji),
        emoji,
        counts[emoji],
        emoji === selectedEmoji
      );
    });
  };

  EMOJIS.forEach((emoji) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "reaction-button";
    button.setAttribute("aria-label", `React with ${emoji}`);
    button.addEventListener("click", async () => {
      if (selectedEmoji === emoji) {
        const { error: deleteError } = await reactionsClient
          .from(REACTIONS_TABLE)
          .delete()
          .eq("photo_id", photoId)
          .eq("visitor_id", visitorId);
        if (deleteError) {
          console.error("Couldn't remove reaction:", deleteError);
          return;
        }
        counts[emoji] -= 1;
        selectedEmoji = null;
      } else if (selectedEmoji) {
        const previousEmoji = selectedEmoji;
        const { error: updateError } = await reactionsClient
          .from(REACTIONS_TABLE)
          .update({ emoji })
          .eq("photo_id", photoId)
          .eq("visitor_id", visitorId);
        if (updateError) {
          console.error("Couldn't update reaction:", updateError);
          return;
        }
        counts[previousEmoji] -= 1;
        counts[emoji] += 1;
        selectedEmoji = emoji;
      } else {
        const { error: insertError } = await reactionsClient
          .from(REACTIONS_TABLE)
          .insert({ photo_id: photoId, emoji, visitor_id: visitorId });
        if (insertError && insertError.code !== "23505") {
          console.error("Couldn't save reaction:", insertError);
          return;
        }
        if (!insertError) counts[emoji] += 1;
        selectedEmoji = emoji;
      }
      refreshButtons();
    });
    buttons.set(emoji, button);
    bar.appendChild(button);
  });

  refreshButtons();

  return bar;
};
