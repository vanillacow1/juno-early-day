/* =========================================================
   SUPABASE CONFIGURATION
   Paste your project values below.
   ========================================================= */
   const SUPABASE_URL = "https://mfxqteusxgzheuxotnme.supabase.co";

   const SUPABASE_ANON_PUBLIC_KEY =
     "sb_publishable_q--3XcghfQJRGQ32B8vbmw_1MufvZZd";
   /* ========================================================= */
   
   // Names used throughout this file — must match your Supabase setup
   const BUCKET_NAME = "juno-photos";
   const TABLE_NAME = "photos";
   
   // Create the Supabase client (uses the CDN script loaded in index.html)
   const supabaseClient = window.supabase.createClient(
     SUPABASE_URL,
     SUPABASE_ANON_PUBLIC_KEY
   );
   
   // ---------- Grab DOM elements ----------
   const fileInput = document.getElementById("fileInput");
   const uploadBtn = document.getElementById("uploadBtn");
   const progressContainer = document.getElementById("progressContainer");
   const progressBar = document.getElementById("progressBar");
   const statusMessage = document.getElementById("statusMessage");
   const photoFeed = document.getElementById("photoFeed");
   const captionInput = document.getElementById("captionInput");
   const dateTimeInput = document.getElementById("dateTimeInput");
   
   // ---------- Helpers ----------
   function setStatus(message, type) {
     statusMessage.textContent = message;
     statusMessage.classList.remove("success", "error");
     if (type) {
       statusMessage.classList.add(type);
     }
   }
   
   function showProgress(show) {
     progressContainer.classList.toggle("hidden", !show);
     if (!show) {
       progressBar.style.width = "0%";
     }
   }
   
   function formatTimestamp(isoString) {
     const date = new Date(isoString);
     return date.toLocaleString(undefined, {
       year: "numeric",
       month: "short",
       day: "numeric",
       hour: "2-digit",
       minute: "2-digit",
     });
   }
   
   // Given a public Storage URL, work out the file path inside the bucket
   // (everything after ".../object/public/<BUCKET_NAME>/")
   function getStoragePathFromUrl(imageUrl) {
     const marker = `/object/public/${BUCKET_NAME}/`;
     const markerIndex = imageUrl.indexOf(marker);
     if (markerIndex === -1) {
       return null;
     }
     return imageUrl.slice(markerIndex + marker.length);
   }
   
   function createPhotoCard(photo) {
     const card = document.createElement("div");
     card.className = "photo-card";
     card.dataset.id = photo.id;
     card.dataset.imageUrl = photo.image_url;
   
     const img = document.createElement("img");
     img.src = photo.image_url;
     img.alt = "Photo of Juno";
     img.loading = "lazy";
   
     const details = document.createElement("div");
     details.className = "photo-details";
   
     if (photo.caption) {
       const caption = document.createElement("p");
       caption.className = "photo-caption";
       caption.textContent = photo.caption;
       details.appendChild(caption);
     }
   
     const meta = document.createElement("div");
     meta.className = "photo-meta";
   
     const timestamp = document.createElement("time");
     timestamp.dateTime = photo.created_at;
     timestamp.textContent = formatTimestamp(photo.created_at);
   
     const deleteBtn = document.createElement("button");
     deleteBtn.className = "delete-btn";
     deleteBtn.type = "button";
     deleteBtn.textContent = "Delete";
     deleteBtn.addEventListener("click", () => handleDelete(photo, card));
   
     meta.append(timestamp, deleteBtn);
     details.appendChild(meta);
     card.append(img, details);
     window.createReactionBar(photo.id).then((reactionBar) => {
       details.appendChild(reactionBar);
     });
     return card;
   }
   
   function setDefaultDateTime() {
     const now = new Date();
     const localDateTime = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
       .toISOString()
       .slice(0, 16);
     dateTimeInput.value = localDateTime;
   }
   
   function renderFeed(photos) {
     photoFeed.innerHTML = "";
   
     if (!photos || photos.length === 0) {
       const empty = document.createElement("p");
       empty.className = "empty-feed-message";
       empty.textContent = "No photos yet — be the first to share one!";
       photoFeed.appendChild(empty);
       return;
     }
   
     photos.forEach((photo) => {
       photoFeed.appendChild(createPhotoCard(photo));
     });
   }
   
   function addPhotoToTopOfFeed(photo) {
     // The main page highlights Juno's newest moment only.
     photoFeed.innerHTML = "";
     const card = createPhotoCard(photo);
     photoFeed.appendChild(card);
   }
   
   // ---------- Load existing photos (newest first) ----------
   async function loadFeed() {
     const { data, error } = await supabaseClient
       .from(TABLE_NAME)
       .select("id, image_url, caption, created_at")
       .order("created_at", { ascending: false })
       .limit(1);
   
     if (error) {
       console.error("Error loading photo feed:", error);
       setStatus(
         "Couldn't load the photo feed. Check the console for details.",
         "error"
       );
       return;
     }
   
     renderFeed(data);
   }
   
   // ---------- Delete handling ----------
   async function handleDelete(photo, cardElement) {
     const confirmed = window.confirm(
       "Are you sure you want to delete this photo?"
     );
     if (!confirmed) {
       return;
     }
   
     try {
       const storagePath = getStoragePathFromUrl(photo.image_url);
   
       if (!storagePath) {
         throw new Error(
           "Could not determine the Storage file path from image_url."
         );
       }
   
       // 1. Delete the actual image file from Storage
       const { error: storageError } = await supabaseClient.storage
         .from(BUCKET_NAME)
         .remove([storagePath]);
   
       if (storageError) {
         // Don't touch the database row if Storage deletion failed
         throw storageError;
       }
   
       // 2. Delete the corresponding row from the database
       const { error: dbError } = await supabaseClient
         .from(TABLE_NAME)
         .delete()
         .eq("id", photo.id);
   
       if (dbError) {
         throw dbError;
       }
   
       // 3. Show the next-most-recent photo, if there is one.
       await loadFeed();
   
       setStatus("Photo deleted.", "success");
     } catch (error) {
       console.error("Delete failed:", error);
       setStatus("Couldn't delete this photo. Please try again.", "error");
     }
   }
   
   // ---------- Upload handling ----------
   async function handleUpload() {
     const file = fileInput.files[0];
     const chosenDate = new Date(dateTimeInput.value);
   
     // 1. Validate that a file was selected
     if (!file) {
       setStatus("Please choose a photo first.", "error");
       return;
     }
   
     // 2. Make sure it is an image
     if (!file.type.startsWith("image/")) {
       setStatus(
         "That doesn't look like an image file. Please choose a photo.",
         "error"
       );
       return;
     }
   
     if (Number.isNaN(chosenDate.getTime())) {
       setStatus("Please choose a valid date and time.", "error");
       return;
     }
   
     uploadBtn.disabled = true;
     showProgress(true);
     progressBar.style.width = "20%";
     setStatus("Uploading...", "");
   
     try {
       // Build a unique filename so uploads never overwrite each other
       const fileExt = file.name.split(".").pop();
       const uniqueName = `${Date.now()}-${Math.random()
         .toString(36)
         .slice(2)}.${fileExt}`;
   
       // 3. Upload it to the Supabase Storage bucket
       const { error: uploadError } = await supabaseClient.storage
         .from(BUCKET_NAME)
         .upload(uniqueName, file);
   
       if (uploadError) {
         throw uploadError;
       }
   
       progressBar.style.width = "60%";
   
       // 4. Get its public URL
       const { data: publicUrlData } = supabaseClient.storage
         .from(BUCKET_NAME)
         .getPublicUrl(uniqueName);
   
       const imageUrl = publicUrlData.publicUrl;
   
       // 5. Save the URL and timestamp to the Supabase database
       const photoRecord = {
         image_url: imageUrl,
         created_at: chosenDate.toISOString(),
       };
       const caption = captionInput.value.trim();
       if (caption) photoRecord.caption = caption;
   
       const { data: insertedRows, error: insertError } = await supabaseClient
         .from(TABLE_NAME)
         .insert([photoRecord])
         .select();
   
       if (insertError) {
         throw insertError;
       }
   
       progressBar.style.width = "100%";
   
       // 6. Add the new photo to the feed
       const newPhoto =
         insertedRows && insertedRows[0]
           ? insertedRows[0]
           : { image_url: imageUrl, created_at: new Date().toISOString() };
       addPhotoToTopOfFeed(newPhoto);
   
       setStatus("Photo uploaded! 🐶", "success");
   
       // 7. Clear the upload control
       fileInput.value = "";
       captionInput.value = "";
       setDefaultDateTime();
     } catch (error) {
       console.error("Upload failed:", error);
       setStatus("Upload failed. Please try again.", "error");
     } finally {
       uploadBtn.disabled = false;
       setTimeout(() => showProgress(false), 500);
     }
   }
   
   uploadBtn.addEventListener("click", handleUpload);
   
   // ---------- Realtime updates ----------
   // Automatically show new photos uploaded by other visitors, without a refresh.
   supabaseClient
     .channel("photos-realtime")
     .on(
       "postgres_changes",
       { event: "INSERT", schema: "public", table: TABLE_NAME },
       (payload) => {
         // Avoid duplicating a photo the current user just added themselves
         const alreadyOnPage = Array.from(photoFeed.querySelectorAll("img")).some(
           (img) => img.src === payload.new.image_url
         );
         if (!alreadyOnPage) {
           addPhotoToTopOfFeed(payload.new);
         }
       }
     )
     .subscribe();
   
   // ---------- Initial load ----------
   setDefaultDateTime();
   loadFeed();
   