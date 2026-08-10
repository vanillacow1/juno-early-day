const SUPABASE_URL = "https://mfxqteusxgzheuxotnme.supabase.co";
const SUPABASE_ANON_PUBLIC_KEY =
  "sb_publishable_q--3XcghfQJRGQ32B8vbmw_1MufvZZd";
const POTTY_TABLE = "potty_events";
const pottyClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_PUBLIC_KEY
);

const pottyForm = document.getElementById("pottyForm");
const pottyType = document.getElementById("pottyType");
const pottyDateTime = document.getElementById("pottyDateTime");
const pottyStatus = document.getElementById("pottyStatus");
const pottyCalendar = document.getElementById("pottyCalendar");
const calendarTitle = document.getElementById("calendarTitle");
const selectedDayTitle = document.getElementById("selectedDayTitle");
const selectedDayEvents = document.getElementById("selectedDayEvents");

const eventInfo = {
  pee: { icon: "💧", label: "Pee" },
  poo: { icon: "💩", label: "Poo" },
  accident_pee: { icon: "💧", label: "Pee accident" },
  accident_poo: { icon: "💩", label: "Poo accident" },
};

let displayedMonth = new Date(
  new Date().getFullYear(),
  new Date().getMonth(),
  1
);
let selectedDateKey = dateKey(new Date());
let pottyEvents = [];

function dateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function setDefaultDateTime() {
  const now = new Date();
  pottyDateTime.value = new Date(
    now.getTime() - now.getTimezoneOffset() * 60000
  )
    .toISOString()
    .slice(0, 16);
}

function eventDateKey(event) {
  return dateKey(new Date(event.occurred_at));
}

function formatTime(isoString) {
  return new Date(isoString).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatSelectedDate(key) {
  return new Date(`${key}T12:00:00`).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function renderSelectedDay() {
  selectedDayTitle.textContent = formatSelectedDate(selectedDateKey);
  selectedDayEvents.innerHTML = "";
  const events = pottyEvents
    .filter((event) => eventDateKey(event) === selectedDateKey)
    .sort((a, b) => new Date(a.occurred_at) - new Date(b.occurred_at));

  if (!events.length) {
    selectedDayEvents.innerHTML =
      '<p class="day-empty">Nothing logged for this day yet.</p>';
    return;
  }
  events.forEach((event) => {
    const info = eventInfo[event.event_type];
    const row = document.createElement("div");
    row.className = `day-event ${
      event.event_type.startsWith("accident") ? "is-accident" : ""
    }`;
    row.innerHTML = `<span class="day-event-icon">${info.icon}</span><span>${
      info.label
    }</span><time datetime="${event.occurred_at}">${formatTime(
      event.occurred_at
    )}</time>`;
    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "remove-potty-event";
    removeButton.setAttribute(
      "aria-label",
      `Remove ${info.label} at ${formatTime(event.occurred_at)}`
    );
    removeButton.title = "Remove entry";
    removeButton.textContent = "×";
    removeButton.addEventListener("click", () => removePottyEvent(event));
    row.appendChild(removeButton);
    selectedDayEvents.appendChild(row);
  });
}

async function removePottyEvent(event) {
  const info = eventInfo[event.event_type];
  const confirmed = window.confirm(
    `Remove the ${info.label.toLowerCase()} entry at ${formatTime(
      event.occurred_at
    )}?`
  );
  if (!confirmed) return;

  const { data, error } = await pottyClient
    .from(POTTY_TABLE)
    .delete()
    .eq("id", event.id)
    .select("id");
  if (error || !data || data.length !== 1) {
    console.error("Couldn't remove potty event:", error);
    pottyStatus.textContent = "Couldn't remove this entry. Please try again.";
    pottyStatus.className = "status-message error";
    return;
  }

  pottyEvents = pottyEvents.filter((pottyEvent) => pottyEvent.id !== event.id);
  renderCalendar();
  renderSelectedDay();
  pottyStatus.textContent = "Entry removed from Juno's calendar.";
  pottyStatus.className = "status-message success";
}

function renderCalendar() {
  const year = displayedMonth.getFullYear();
  const month = displayedMonth.getMonth();
  const monthName = displayedMonth.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
  calendarTitle.textContent = monthName;
  pottyCalendar.innerHTML = "";

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayKey = dateKey(new Date());

  for (let blank = 0; blank < firstDay; blank += 1) {
    const spacer = document.createElement("div");
    spacer.className = "calendar-day is-empty";
    pottyCalendar.appendChild(spacer);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const key = dateKey(new Date(year, month, day));
    const dayEvents = pottyEvents.filter(
      (event) => eventDateKey(event) === key
    );
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "calendar-day";
    cell.classList.toggle("is-today", key === todayKey);
    cell.classList.toggle("is-selected", key === selectedDateKey);
    cell.setAttribute(
      "aria-label",
      `${formatSelectedDate(key)}: ${dayEvents.length} occurrences`
    );
    cell.innerHTML = `<span class="calendar-date">${day}</span>`;

    const markers = document.createElement("div");
    markers.className = "calendar-markers";
    dayEvents
      .sort((a, b) => new Date(a.occurred_at) - new Date(b.occurred_at))
      .forEach((event) => {
        const info = eventInfo[event.event_type];
        const marker = document.createElement("span");
        marker.className = `calendar-marker ${
          event.event_type.startsWith("accident") ? "is-accident" : ""
        }`;
        marker.title = `${info.label} at ${formatTime(event.occurred_at)}`;
        marker.textContent = `${info.icon}${formatTime(event.occurred_at)}`;
        markers.appendChild(marker);
      });
    cell.appendChild(markers);
    cell.addEventListener("click", () => {
      selectedDateKey = key;
      renderCalendar();
      renderSelectedDay();
    });
    pottyCalendar.appendChild(cell);
  }
}

async function loadPottyEvents() {
  const { data, error } = await pottyClient
    .from(POTTY_TABLE)
    .select("id, event_type, occurred_at")
    .order("occurred_at", { ascending: true });
  if (error) {
    console.error("Couldn't load potty events:", error);
    pottyStatus.textContent = "Couldn't load the calendar. Please try again.";
    pottyStatus.className = "status-message error";
    return;
  }
  pottyEvents = data;
  renderCalendar();
  renderSelectedDay();
}

pottyForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const occurredAt = new Date(pottyDateTime.value);
  if (Number.isNaN(occurredAt.getTime())) return;

  const { error } = await pottyClient.from(POTTY_TABLE).insert({
    event_type: pottyType.value,
    occurred_at: occurredAt.toISOString(),
  });
  if (error) {
    console.error("Couldn't add potty event:", error);
    pottyStatus.textContent =
      "Couldn't save this occurrence. Please try again.";
    pottyStatus.className = "status-message error";
    return;
  }
  selectedDateKey = dateKey(occurredAt);
  displayedMonth = new Date(occurredAt.getFullYear(), occurredAt.getMonth(), 1);
  pottyStatus.textContent = "Added to Juno's calendar.";
  pottyStatus.className = "status-message success";
  setDefaultDateTime();
  loadPottyEvents();
});

document.getElementById("previousMonth").addEventListener("click", () => {
  displayedMonth = new Date(
    displayedMonth.getFullYear(),
    displayedMonth.getMonth() - 1,
    1
  );
  renderCalendar();
});
document.getElementById("nextMonth").addEventListener("click", () => {
  displayedMonth = new Date(
    displayedMonth.getFullYear(),
    displayedMonth.getMonth() + 1,
    1
  );
  renderCalendar();
});

pottyClient
  .channel("potty-events-realtime")
  .on(
    "postgres_changes",
    { event: "INSERT", schema: "public", table: POTTY_TABLE },
    loadPottyEvents
  )
  .subscribe();

setDefaultDateTime();
loadPottyEvents();
