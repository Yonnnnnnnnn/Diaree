// Data storage for PaceNotes
let paceNotes = JSON.parse(localStorage.getItem('paceNotes')) || [];
let currentTimer = null;
let timeLeft = 60; // 1 minute in seconds
let uploadedImages = [];
let agendaGoals = JSON.parse(localStorage.getItem('agendaGoals')) || [];

let diaryGoals = [];

let lastCursorPosition = { top: 0, left: 0 };

let editingNote = JSON.parse(localStorage.getItem('editingNote')) || null;

// ===== PATCH: Pastikan fungsi global tersedia =====
window.exitWriting = exitWriting;
window.showSaveWizard = showSaveWizard;
window.cancelSave = cancelSave;
window.removeImage = removeImage;
window.renderMediaPreview = renderMediaPreview;
// ===== END PATCH =====

// Data untuk interaksi (like, comment, bookmark)
let postInteractions = JSON.parse(localStorage.getItem('postInteractions')) || {};

// =============== PATCH GOAL RENDERING ===============

// Render ulang preview
function renderImagePreview() {
  const container = document.getElementById("image-preview-container");
  container.innerHTML = "";

  uploadedImages.forEach((src, idx) => {
    const img = document.createElement("img");
    img.src = src;
    img.alt = "Preview " + (idx + 1);

    // Klik untuk hapus
    img.addEventListener("click", () => {
      uploadedImages.splice(idx, 1);
      renderImagePreview();
    });

    container.appendChild(img);
  });
}

// Tambah gambar (contoh input file)
function handleImageUpload(fileInput) {
  const files = fileInput.files;
  for (let i = 0; i < files.length; i++) {
    const reader = new FileReader();
    reader.onload = function (e) {
      uploadedImages.push(e.target.result);
      renderImagePreview();
    };
    reader.readAsDataURL(files[i]);
  }
  fileInput.value = ""; // reset
}

// === FLOATING BEHAVIOR WITH KEYBOARD ===
if (window.visualViewport) {
  const previewContainer = document.getElementById("image-preview-container");
  window.visualViewport.addEventListener("resize", () => {
    const offset = window.innerHeight - window.visualViewport.height;
    if (offset > 100) {
      // Keyboard muncul
      previewContainer.style.bottom = offset + 60 + "px"; // naik di atas keyboard + FAB
    } else {
      // Keyboard hilang
      previewContainer.style.bottom = "70px";
    }
  });
}

// Convert diary content yang punya <span class="goal-ref"> menjadi chip live
// ✅ Fungsi baru: render goals jadi chip atau inline text

function renderDiaryWithGoals(content = '', opts = {}) {
  const mode = opts.mode || 'chip'; // 'chip' untuk diarylist/detail, 'inline' untuk feed
  if (!content) return '';

  const temp = document.createElement('div');
  temp.innerHTML = content;

  temp.querySelectorAll('span.goal-ref').forEach(ref => {
    const goalId = String(ref.dataset.id || '');
    const goal = agendaGoals.find(g => String(g.id) === goalId);

    if (goal) {
      if (mode === 'chip') {
        // Gunakan chip (ada emoji + teks)
        const chip = createGoalChip(goal);
        ref.replaceWith(chip);
      } else {
        // Inline text (emoji + teks, warna sesuai status)
        const inline = document.createElement('span');
        inline.className = 'goal-inline-text ' + (goal.status || 'active');
        inline.textContent = (goal.icon ? goal.icon + ' ' : '') + goal.text;
        ref.replaceWith(inline);
      }
    } else {
      ref.remove(); // kalau goalId tidak ditemukan, hilangkan
    }
  });

  return temp.innerHTML;
}



function renderDiaryWithGoalText(content) {
  if (!content) return "";

  console.log("[DEBUG] renderDiaryWithGoalText called with:", content);

  // Cari semua <span class="goal-ref" data-id="...">
  const tempDiv = document.createElement("div");
  tempDiv.innerHTML = content;

  tempDiv.querySelectorAll("span.goal-ref").forEach(span => {
    const goalId = span.getAttribute("data-id");
    const goal = agendaGoals.find(g => g.id === goalId);

    console.log("[DEBUG] Processing goal-ref → goalId:", goalId, "found:", !!goal, goal);

    if (goal) {
      // Tentukan status class
      const statusClass = goal.status || "active";
      const replacement = `<span class="goal-inline-text ${statusClass}">${goal.text}</span>`;

      console.log(
        "[DEBUG] replacing goal-ref with span:",
        replacement
      );

      span.outerHTML = replacement;
    } else {
      console.warn("[DEBUG] No goal found for goalId:", goalId);
    }
  });

  const result = tempDiv.innerHTML;
  console.log("[DEBUG] After renderDiaryWithGoalText:", result);

  return result;
}






// Fungsi render chip tetap sederhana, tanpa menu titik tiga
function createGoalChip(goal) {
  const chip = document.createElement('span');
  chip.className = `goal-chip ${goal.status || 'active'}`;
  chip.dataset.id = goal.id;
  chip.dataset.status = goal.status || 'active';

  chip.innerHTML = `
    <span class="goal-prefix">${goal.icon || '🎯'}</span>
    <span class="goal-text">${goal.text}</span>
    <button class="goal-delete" title="Delete Goal">&times;</button>
  `;

  // Klik chip → buka detail goal di agenda
  chip.addEventListener('click', (e) => {
    if (!e.target.classList.contains('goal-delete')) {
      window.location.href = `agenda.html?id=${goal.id}`;
    }
  });

  // Klik tombol delete → hapus goal
  chip.querySelector('.goal-delete').addEventListener('click', (e) => {
    e.stopPropagation();
    deleteGoalById(goal.id);
    chip.remove();

    if (typeof loadAgendaGoals === 'function') loadAgendaGoals();
    if (typeof loadFeed === 'function') loadFeed();
    if (typeof loadDiaryList === 'function') loadDiaryList();

    const idx = diaryGoals.findIndex(g => g.id === goal.id);
    if (idx !== -1) diaryGoals.splice(idx, 1);
  });

  return chip;
}


function updateGoalStatus(goalId, newStatus) {
  const goal = agendaGoals.find(g => String(g.id) === String(goalId));
  if (!goal) {
    console.warn('[WARN] goal not found in agendaGoals', goalId);
    return;
  }

  goal.status = newStatus;
  localStorage.setItem('agendaGoals', JSON.stringify(agendaGoals));

  console.log(`[DEBUG] updateGoalStatus`, goalId, '→', newStatus);
  console.log(`[DEBUG] current page:`, window.location.pathname);

  // Always refresh agenda
  if (typeof loadAgendaGoals === 'function') {
    console.log('[DEBUG] refreshing agenda list...');
    loadAgendaGoals();
  }

  // Always refresh diary list (preview chip)
  if (typeof loadDiaryList === 'function') {
    console.log('[DEBUG] refreshing diary list...');
    loadDiaryList();
  }

  // Refresh diary detail only if inside diary.html with id param
  if (window.location.pathname.includes("diary.html")) {
    const params = new URLSearchParams(window.location.search);
    const diaryId = params.get("id");

    if (diaryId && typeof loadDiaryDetail === 'function') {
      console.log('[DEBUG] refreshing diary detail for', diaryId);
      loadDiaryDetail(diaryId);
    } else {
      // 🔥 tambahan: kalau sedang di editor mode
      const editorEl = document.getElementById("pace-content");
      if (editorEl && window.editingNote) {
        console.log('[DEBUG] refreshing editor goals...');
        
        // update isi editingNote.content dengan versi terbaru (goal-ref tetap, status sync)
        window.editingNote.content = window.editingNote.content || '';
        
        // render ulang goal-ref jadi chip
        editorEl.innerHTML = renderDiaryWithGoals(window.editingNote.content);

        // re-bind delete & click handler setelah chip diganti
        editorEl.querySelectorAll('.goal-chip').forEach(chip => {
          chip.addEventListener('click', (e) => {
            if (!e.target.classList.contains('goal-delete')) {
              window.location.href = `agenda.html?id=${chip.dataset.id}`;
            }
          });
          const delBtn = chip.querySelector('.goal-delete');
          if (delBtn) {
            delBtn.addEventListener('click', (e) => {
              e.stopPropagation();
              deleteGoalById(chip.dataset.id);
              chip.remove();
            });
          }
        });
      }
    }
  }
}




function updateGoalText(goalId, newText) {
  const goal = agendaGoals.find(g => g.id === goalId);
  if (goal) {
    goal.text = newText;
    localStorage.setItem('agendaGoals', JSON.stringify(agendaGoals));

    const diaryGoal = diaryGoals.find(g => g.id === goalId);
    if (diaryGoal) diaryGoal.text = newText;

    const oldChip = document.querySelector(`.goal-chip[data-id="${goalId}"]`);
    if (oldChip) {
      oldChip.replaceWith(createGoalChip(goal));
    }
  }
}



// Fungsi untuk handle like
function handleLike(postId) {
    if (!postInteractions[postId]) {
        postInteractions[postId] = {
            likes: 0,
            bookmarks: 0,
            comments: [],
            liked: false,
            bookmarked: false
        };
    }
    
    if (postInteractions[postId].liked) {
        postInteractions[postId].likes--;
        postInteractions[postId].liked = false;
    } else {
        postInteractions[postId].likes++;
        postInteractions[postId].liked = true;
    }
    
    localStorage.setItem('postInteractions', JSON.stringify(postInteractions));
    updateInteractionUI(postId);
}

// Fungsi untuk handle bookmark
function handleBookmark(postId) {
    if (!postInteractions[postId]) {
        postInteractions[postId] = {
            likes: 0,
            bookmarks: 0,
            comments: [],
            liked: false,
            bookmarked: false
        };
    }
    
    if (postInteractions[postId].bookmarked) {
        postInteractions[postId].bookmarks--;
        postInteractions[postId].bookmarked = false;
    } else {
        postInteractions[postId].bookmarks++;
        postInteractions[postId].bookmarked = true;
    }
    
    localStorage.setItem('postInteractions', JSON.stringify(postInteractions));
    updateInteractionUI(postId);
}

// Fungsi untuk handle comment (akan mengarahkan ke detail)
function handleComment(postId) {
    window.location.href = `detail_diary.html?id=${postId}&focus=comment`;
}

// Fungsi untuk update UI interaksi
function updateInteractionUI(postId) {
    const interaction = postInteractions[postId] || {
        likes: 0,
        bookmarks: 0,
        comments: [],
        liked: false,
        bookmarked: false
    };
    
    // Update di home feed
    const likeCountElement = document.querySelector(`[data-post-id="${postId}"] .like-count`);
    const bookmarkCountElement = document.querySelector(`[data-post-id="${postId}"] .bookmark-count`);
    const commentCountElement = document.querySelector(`[data-post-id="${postId}"] .comment-count`);
    
    if (likeCountElement) {
        likeCountElement.textContent = interaction.likes;
        likeCountElement.parentElement.classList.toggle('active', interaction.liked);
    }
    
    if (bookmarkCountElement) {
        bookmarkCountElement.textContent = interaction.bookmarks;
        bookmarkCountElement.parentElement.classList.toggle('active', interaction.bookmarked);
    }
    
    if (commentCountElement) {
        commentCountElement.textContent = interaction.comments.length;
    }
    
    // Update di detail page jika ada
    if (window.location.pathname.includes('diary_detail.html')) {
        const urlParams = new URLSearchParams(window.location.search);
        const currentPostId = urlParams.get('id');
        
        if (currentPostId === postId) {
            document.getElementById('like-count-detail').textContent = interaction.likes;
            document.getElementById('bookmark-count-detail').textContent = interaction.bookmarks;
            document.getElementById('comment-count-detail').textContent = interaction.comments.length;
            
            document.getElementById('like-btn-detail').classList.toggle('active', interaction.liked);
            document.getElementById('bookmark-btn-detail').classList.toggle('active', interaction.bookmarked);
        }
    }
}

// Fungsi untuk menambah komentar
function addComment(postId, commentText) {
    if (!postInteractions[postId]) {
        postInteractions[postId] = {
            likes: 0,
            bookmarks: 0,
            comments: [],
            liked: false,
            bookmarked: false
        };
    }
    
    postInteractions[postId].comments.push({
        id: Date.now(),
        text: commentText,
        author: 'You',
        timestamp: new Date().toISOString()
    });
    
    localStorage.setItem('postInteractions', JSON.stringify(postInteractions));
    updateInteractionUI(postId);
    
    // Jika di halaman detail, reload comments
    if (window.location.pathname.includes('diary_detail.html')) {
        const urlParams = new URLSearchParams(window.location.search);
        const currentPostId = urlParams.get('id');
        
        if (currentPostId === postId) {
            loadComments(postId);
        }
    }
}

// Fungsi untuk memuat komentar
function loadComments(postId) {
    const commentsContainer = document.getElementById('comments-container');
    if (!commentsContainer) return;
    
    const interaction = postInteractions[postId] || {
        likes: 0,
        bookmarks: 0,
        comments: [],
        liked: false,
        bookmarked: false
    };
    
    commentsContainer.innerHTML = '';
    
    if (interaction.comments.length === 0) {
        commentsContainer.innerHTML = '<p class="no-comments">No comments yet. Be the first to comment!</p>';
        return;
    }
    
    interaction.comments.forEach(comment => {
        const commentDate = new Date(comment.timestamp);
        const formattedDate = commentDate.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
        
        const commentElement = document.createElement('div');
        commentElement.className = 'comment';
        commentElement.innerHTML = `
            <div class="comment-avatar">${comment.author.charAt(0)}</div>
            <div class="comment-content">
                <div class="comment-author">${comment.author}</div>
                <div class="comment-text">${comment.text}</div>
                <div class="comment-date">${formattedDate}</div>
            </div>
        `;
        
        commentsContainer.appendChild(commentElement);
    });
}

// Pastikan fungsi tersedia di global scope
window.handleLike = handleLike;
window.handleBookmark = handleBookmark;
window.handleComment = handleComment;
window.addComment = addComment;



function setupMediaUpload() {
  const mediaBtn = document.getElementById('media-btn');
  const mediaInput = document.getElementById('media-input');
  const previewContainer = document.getElementById('image-preview-container'); // 🔥 ganti targetnya

  if (!mediaBtn || !mediaInput || !previewContainer) return;

  mediaBtn.addEventListener('click', () => mediaInput.click());

  mediaInput.addEventListener('change', function () {
    const files = Array.from(this.files);
    files.forEach(file => {
      if (!file.type.startsWith('image/')) return;
      resizeImage(file, 800, 800, (resizedDataUrl) => {
        uploadedImages.push(resizedDataUrl);

        const preview = document.createElement('div');
        preview.className = 'image-preview';
        preview.innerHTML = `
          <img src="${resizedDataUrl}" alt="preview">
          <div class="remove-image" onclick="removeImage(this)">×</div>
        `;
        previewContainer.appendChild(preview);
        previewContainer.style.display = "flex"; // pastikan tampil
      });
    });
    this.value = ""; // reset supaya bisa upload file sama lagi
  });
}


// Utility untuk compress/resize gambar sebelum disimpan
function resizeImage(file, maxWidth, maxHeight, callback) {
  const reader = new FileReader();
  reader.onload = function(event) {
    const img = new Image();
    img.onload = function() {
      let canvas = document.createElement('canvas');
      let ctx = canvas.getContext('2d');

      let width = img.width;
      let height = img.height;

      // Hitung scale agar sesuai maxWidth & maxHeight
      if (width > height) {
        if (width > maxWidth) {
          height *= maxWidth / width;
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width *= maxHeight / height;
          height = maxHeight;
        }
      }

      canvas.width = width;
      canvas.height = height;

      ctx.drawImage(img, 0, 0, width, height);

      // Kembalikan hasil dalam bentuk base64 (Data URL)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      callback(dataUrl);
    };
    img.src = event.target.result;
  };
  reader.readAsDataURL(file);
}



function removeImage(element) {
  const preview = element.parentElement;
  const imgSrc = preview.querySelector('img').src;
  uploadedImages = uploadedImages.filter(src => src !== imgSrc);
  preview.remove();
}




// [TAMBAH] Fungsi untuk menangani penghapusan goal


// [TAMBAH] Fungsi untuk menghapus goal berdasarkan ID
function deleteGoalById(goalId) {
  agendaGoals = agendaGoals.filter(goal => goal.id !== goalId);
  localStorage.setItem('agendaGoals', JSON.stringify(agendaGoals));
}

// [TAMBAH] Fungsi untuk notifikasi penghapusan
function showDeletionNotification() {
  const toast = document.getElementById('toast-notification');
  if (!toast) return;
  
  toast.textContent = 'Press Backspace again to delete this goal';
  toast.style.background = '#FF5722';
  toast.classList.add('show');
  
  setTimeout(() => {
    toast.classList.remove('show');
    // Kembalikan ke notifikasi biasa setelah 2 detik
    setTimeout(() => {
      toast.style.background = '#4CAF50';
    }, 300);
  }, 2000);
}

// [TAMBAH] Fungsi untuk notifikasi penghapusan berhasil
function showDeleteSuccessNotification() {
  const toast = document.getElementById('toast-notification');
  if (!toast) return;
  
  toast.textContent = 'Goal deleted!';
  toast.style.background = '#4CAF50';
  toast.classList.add('show');
  
  setTimeout(() => {
    toast.classList.remove('show');
  }, 2000);
}

// [MODIFIKASI] Fungsi showAgendaDetectionNotification
function showAgendaDetectionNotification(agendaItems) {
  const toast = document.getElementById('toast-notification');
  if (!toast) return;
  
  toast.textContent = 'Goals added!';
  toast.style.background = '#4CAF50';
  toast.classList.add('show');
  
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}










// Optimasi fungsi saveAgendaGoals untuk menghindari duplikasi
function saveAgendaGoals(goals) {
  console.log("Saving agenda goals:", goals);
  
  if (!goals || goals.length === 0) {
    console.log("No goals to save");
    return [];
  }
  
  const newGoals = goals.map(goalText => ({
    id: Date.now() + Math.random().toString(36).substr(2, 9),
    text: goalText,
    status: 'active',   // 🔥 tambahkan status
    createdAt: new Date().toISOString(),
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  }));

  
  const existingGoals = JSON.parse(localStorage.getItem('agendaGoals')) || [];
  
  // Filter yang benar-benar baru (beda text ATAU sudah completed)
  const nonDuplicateGoals = newGoals.filter(newGoal => 
    !existingGoals.some(existingGoal => 
      existingGoal.text === newGoal.text && !existingGoal.completed
    )
  );
  
  if (nonDuplicateGoals.length === 0) {
    console.log("No new goals to add (possible duplicates)");
    return [];
  }
  
  const updatedGoals = [...existingGoals, ...nonDuplicateGoals];
  localStorage.setItem('agendaGoals', JSON.stringify(updatedGoals));
  agendaGoals = updatedGoals;
  
  console.log("Goals saved successfully:", nonDuplicateGoals);
  console.log("Existing goals:", existingGoals);
  console.log("Non-duplicate goals:", nonDuplicateGoals);
  
  return nonDuplicateGoals;
}



// Optimasi: Gunakan debounce yang lebih efficient
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
  
}

// PATCHED: loadAgendaGoals tanpa checkbox
function loadAgendaGoals() {
  const taskList = document.getElementById('task-list');
  if (!taskList) return;
  
  // Clear existing items except the static ones if any
  const staticItems = taskList.querySelectorAll('li.agenda-item[data-static]');
  taskList.innerHTML = '';
  staticItems.forEach(item => taskList.appendChild(item));
  
  // Add agenda goals from storage
  agendaGoals.forEach(goal => {
    const li = document.createElement('li');
    li.className = 'agenda-item';
    li.dataset.id = goal.id;
    
    // Format due date
    const dueDate = new Date(goal.dueDate);
    const formattedDate = dueDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    // PATCH: gunakan goal.prefix jika ada, fallback ke '()'
    const prefix = goal.prefix || localStorage.getItem('goalPrefixChar') || '()';
    
    li.innerHTML = `
      <div class="agenda-item-content">
        <div>
          <div>
            <span style="margin-right:6px;">${prefix}</span>${goal.text}
          </div>
          <div class="agenda-date">Due: ${formattedDate}</div>
        </div>
        <div class="agenda-options">
          <button class="agenda-options-btn">⋮</button>
          <div class="agenda-options-dropdown">
            <button class="agenda-action accomplish">Accomplish</button>
            <button class="agenda-action edit">Edit</button>
            <button class="agenda-action cancel">Cancel</button>
          </div>
        </div>
      </div>
      <i class="fas fa-flag medium-priority"></i>
    `;
    
    // Setup swipe & menu
    setupSwipeForAgendaItem(li, goal.id);
    setupAgendaItemMenu(li, goal.id);
    
    taskList.appendChild(li);
  });
}

// HAPUS fungsi toggleGoalCompletion (tidak dipakai lagi)



function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/[&<>"']/g, function (m) {
    return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m];
  });
}
// Pastikan ini hanya didaftarkan satu kali
if (!window.__agendaOptionsGlobalInit) {
  document.addEventListener('click', () => {
    document.querySelectorAll('.agenda-options-dropdown.show').forEach(d => d.classList.remove('show'));
  });
  window.__agendaOptionsGlobalInit = true;
}

/**
 * Pasang event handler menu pada setiap agenda item (dipanggil dari loadAgendaGoals)
 */
// Pasang menu tiga titik di agenda item
function setupAgendaItemMenu(li, goalId) {
  if (!li || !goalId) return;

  const btn = li.querySelector('.agenda-options-btn');
  const dropdown = li.querySelector('.agenda-options-dropdown');
  if (!btn || !dropdown) return;

  // Toggle dropdown
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    // tutup semua dropdown lain
    document.querySelectorAll('.agenda-options-dropdown.show')
      .forEach(d => { if (d !== dropdown) d.classList.remove('show'); });
    dropdown.classList.toggle('show');
  });

  // Accomplish
  const doAccomplish = dropdown.querySelector('.agenda-action.accomplish');
  if (doAccomplish) {
    doAccomplish.addEventListener('click', (e) => {
      e.stopPropagation();
      console.log('[DEBUG] menu → accomplish', goalId);
      updateGoalStatus(goalId, 'accomplished');
      dropdown.classList.remove('show');
    });
  }

  // Edit
  const doEdit = dropdown.querySelector('.agenda-action.edit');
  if (doEdit) {
    doEdit.addEventListener('click', (e) => {
      e.stopPropagation();
      const goal = agendaGoals.find(g => String(g.id) === String(goalId));
      if (!goal) return;
      const newText = prompt('Edit goal:', goal.text || '');
      if (newText) updateGoalText(goalId, newText.trim());
      dropdown.classList.remove('show');
    });
  }

  // Cancel
  const doCancel = dropdown.querySelector('.agenda-action.cancel');
  if (doCancel) {
    doCancel.addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm('Mark this goal as canceled?')) {
        console.log('[DEBUG] menu → cancel', goalId);
        updateGoalStatus(goalId, 'canceled');
      }
      dropdown.classList.remove('show');
    });
  }
}

/**
 * Update status goal dan sinkronisasi UI + storage
 */
function updateGoalStatus(goalId, newStatus) {
  const goal = agendaGoals.find(g => String(g.id) === String(goalId));
  if (!goal) {
    console.warn('[WARN] goal not found in agendaGoals', goalId);
    return;
  }

  goal.status = newStatus;
  localStorage.setItem('agendaGoals', JSON.stringify(agendaGoals));

  console.log(`[DEBUG] updateGoalStatus`, goalId, '→', newStatus);
  console.log(`[DEBUG] current page:`, window.location.pathname);

  // Always refresh agenda
  if (typeof loadAgendaGoals === 'function') {
    console.log('[DEBUG] refreshing agenda list...');
    loadAgendaGoals();
  }

  // Always refresh diary list (preview chip)
  if (typeof loadDiaryList === 'function') {
    console.log('[DEBUG] refreshing diary list...');
    loadDiaryList();
  }

  // Only refresh diary detail if we are inside diary.html
  if (window.location.pathname.includes("diary.html") && typeof loadDiaryDetail === 'function') {
    const params = new URLSearchParams(window.location.search);
    const diaryId = params.get("id");
    if (diaryId) {
      console.log('[DEBUG] refreshing diary detail for', diaryId);
      loadDiaryDetail(diaryId);
    } else {
      console.log('[DEBUG] skip diary detail refresh → no diaryId in URL');
    }
  }
}



/**
 * Update text of a goal (rename) and sync
 */
function updateGoalText(goalId, newText) {
  console.log('[DEBUG] updateGoalText', goalId, newText);
  const idx = agendaGoals.findIndex(g => String(g.id) === String(goalId));
  if (idx === -1) {
    console.warn('[WARN] goal not found in agendaGoals', goalId);
    return;
  }
  agendaGoals[idx].text = newText;
  localStorage.setItem('agendaGoals', JSON.stringify(agendaGoals));

  // update diaryGoals mirror
  const dg = diaryGoals.find(g => String(g.id) === String(goalId));
  if (dg) dg.text = newText;

  // Replace chips in diary/detail
  const goal = agendaGoals[idx];
  document.querySelectorAll(`.goal-chip[data-id="${goalId}"]`).forEach(node => {
    node.replaceWith(createGoalChip(goal));
  });

  // Refresh agenda list UI to show new text
  if (typeof loadAgendaGoals === 'function') loadAgendaGoals();
}



// Add this function to setup swipe for agenda items
function setupSwipeForAgendaItem(element, goalId) {
  let startX, startY, diffX, diffY;
  let isSwiping = false;
  
  element.addEventListener('touchstart', function(e) {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    isSwiping = true;
    this.style.transition = 'none';
  });
  
  element.addEventListener('touchmove', function(e) {
    if (!isSwiping) return;
    
    diffX = e.touches[0].clientX - startX;
    diffY = e.touches[0].clientY - startY;
    
    // Only consider horizontal swipe
    if (Math.abs(diffX) > Math.abs(diffY)) {
      e.preventDefault(); // Prevent vertical scroll
      this.style.transform = `translateX(${diffX}px)`;
      
      // Change background color based on swipe direction
      if (diffX > 50) {
        this.style.background = 'rgba(76, 201, 240, 0.3)'; // Light blue for right swipe
      } else if (diffX < -50) {
        this.style.background = 'rgba(255, 87, 34, 0.3)'; // Light red for left swipe
      }
    }
  });
  
  element.addEventListener('touchend', function() {
    isSwiping = false;
    this.style.transition = 'transform 0.3s ease, background 0.3s ease';
    
    // If swiped more than 100px, complete the goal
    if (Math.abs(diffX) > 100) {
      this.style.transform = `translateX(${diffX > 0 ? '100%' : '-100%'})`;
      
      setTimeout(() => {
        completeGoalById(goalId);
      }, 300);
    } else {
      // Return to original position
      this.style.transform = 'translateX(0)';
      this.style.background = '';
    }

    if (diffX > 100) {
      completeGoalById(goalId);
    } else if (diffX < -100) {
      cancelGoalById(goalId);
    }

  });
}

// Add this function to complete a goal by ID
function completeGoalById(goalId) {
  agendaGoals = agendaGoals.map(goal => {
    if (goal.id == goalId) {
      return { ...goal, status: 'accomplished', completedAt: new Date().toISOString() };
    }
    return goal;
  });
  localStorage.setItem('agendaGoals', JSON.stringify(agendaGoals));
  loadAgendaGoals();
}

function cancelGoalById(goalId) {
  agendaGoals = agendaGoals.map(goal => {
    if (goal.id == goalId) {
      return { ...goal, status: 'canceled' };
    }
    return goal;
  });
  localStorage.setItem('agendaGoals', JSON.stringify(agendaGoals));
  loadAgendaGoals();
}

// Modify the toggleGoalCompletion function




// Login function - redirects to diary page
function login(event) {
  event.preventDefault();
  const username = document.getElementById('username').value;
  window.location.href = "diary.html";
}

// Fungsi untuk menampilkan tombol save
function showSaveButton() {
  const saveButton = document.getElementById('save-button');
  if (saveButton) {
    saveButton.classList.remove('hidden');
    console.log('Save button shown');
    
    // Pastikan event listener terpasang
  }
}

// Start the writing timer
function startTimer() {
  const timerElement = document.getElementById('timer');
  
  if (currentTimer) {
    clearInterval(currentTimer);
  }
  
  timeLeft = 60;
  updateTimerDisplay();
  
  currentTimer = setInterval(() => {
    timeLeft--;
    updateTimerDisplay();
    
    if (timeLeft <= 0) {
      clearInterval(currentTimer);
      showSaveButton(); // TAMBAHKAN INI - tombol muncul saat timer habis
    }
  }, 1000);
}

// Update timer display
function updateTimerDisplay() {
  const timerElement = document.getElementById('timer');
  if (timerElement) {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    timerElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
}



// Pastikan fungsi showSaveWizard dapat dipanggil langsung
function showSaveWizard() {
  const saveWizard = document.getElementById('save-wizard');
  if (saveWizard) saveWizard.classList.remove('hidden');
  
}

// Hide the save wizard
function hideSaveWizard() {
  const saveWizard = document.getElementById('save-wizard');
  if (saveWizard) {
    saveWizard.classList.add('hidden');
  }
}

// Exit writing mode
function exitWriting() {
  if (confirm('Are you sure you want to exit? Your note will not be saved.')) {
    localStorage.removeItem('editingNote');
    window.location.href = "diarylist.html";
  }
}






// Cancel save and return to writing
function cancelSave() {
  const saveWizard = document.getElementById('save-wizard');
  if (saveWizard) saveWizard.classList.add('hidden');
  hideSaveWizard();
}




function loadFeed() {
  const feedContainer = document.getElementById('feed-container');
  if (!feedContainer) {
    console.warn('[WARN] #feed-container tidak ditemukan');
    return;
  }

  feedContainer.innerHTML = '';

  const sharedNotes = paceNotes.filter(note => note.shared);

  if (sharedNotes.length === 0) {
    feedContainer.innerHTML = `
      <div class="card">
        <div class="card-content">
          <h3>No shared notes yet</h3>
          <p>When your friends share their PaceNotes, they'll appear here.</p>
        </div>
      </div>
    `;
    return;
  }

  sharedNotes.forEach(note => {
    console.group(`[DEBUG] Processing note ${note.id}`);

    // ---- Media
    let mediaHTML = '';
    if (note.images && note.images.length > 0) {
      if (note.images.length === 1) {
        mediaHTML = `<div class="media-single"><img src="${note.images[0]}" alt="post image"></div>`;
      } else {
        mediaHTML = `
          <div class="media-grid">
            ${note.images.map(img => `<img src="${img}" alt="post image">`).join('')}
          </div>
        `;
      }
    }

    // ---- Preview text (preserve <span class="goal-ref"> dan <br>)
    let previewText = '';
    if (note.content) {
      // normalisasi <div> jadi <br> biar rapi
      let rawHTML = note.content
        .replace(/<div><br><\/div>/gi, '<br>')
        .replace(/<div>/gi, '')
        .replace(/<\/div>/gi, '<br>')
        .replace(/<p>/gi, '')
        .replace(/<\/p>/gi, '<br>');

      console.log("[DEBUG] rawHTML (preserve goal-ref):", rawHTML);

      // pecah berdasarkan <br>, tapi biarkan span.goal-ref tetap ada
      let parts = rawHTML.split(/<br\s*\/?>/i).map(p => p.trim()).filter(p => p);
      console.log("[DEBUG] parts array:", parts);

      if (parts.length <= 5) {
        previewText = parts.join('<br>');
      } else {
        previewText = parts.slice(0, 5).join('<br>') + '<br>...';
      }

      console.log("[DEBUG] previewText (with goal-ref):", previewText);
    }

    // ---- Render goals inline
    const renderedPreview = renderDiaryWithGoals(previewText || '', { mode: 'inline' });
    console.log("[DEBUG] renderedPreview:", renderedPreview);

    console.groupEnd();

    // ---- Card HTML
    feedContainer.innerHTML += `
      <div class="card" data-post-id="${note.id}">
        <div class="card-header">
          <div class="avatar">${note.author.charAt(0)}</div>
          <div>
            <h3>${note.author}</h3>
            <p>${new Date(note.timestamp).toLocaleDateString()}</p>
          </div>
        </div>
        <div class="card-content" onclick="viewDiaryDetail('${note.id}')">
          <div class="note-text" style="white-space: pre-wrap;">${renderedPreview}</div>
          ${mediaHTML}
        </div>
        <div class="card-actions">
          <div class="action-btn ${postInteractions[note.id]?.liked ? 'active' : ''}" onclick="handleLike('${note.id}')">
            <i class="far fa-heart"></i> 
            <span class="like-count">${postInteractions[note.id]?.likes || 0}</span>
          </div>
          <div class="action-btn" onclick="handleComment('${note.id}')">
            <i class="far fa-comment"></i> 
            <span class="comment-count">${postInteractions[note.id]?.comments?.length || 0}</span>
          </div>
          <div class="action-btn ${postInteractions[note.id]?.bookmarked ? 'active' : ''}" onclick="handleBookmark('${note.id}')">
            <i class="far fa-bookmark"></i> 
            <span class="bookmark-count">${postInteractions[note.id]?.bookmarks || 0}</span>
          </div>
        </div>
      </div>
    `;
  });
}











// Load profile notes in grid layout
function loadProfileGrid() {
  const postsContainer = document.getElementById('posts-container');
  const taggedContainer = document.getElementById('tagged-container');
  if (!postsContainer) return;

  postsContainer.innerHTML = '';
  taggedContainer.innerHTML = '';

  document.getElementById('posts-count').textContent = paceNotes.length;

  if (paceNotes.length === 0) {
    postsContainer.innerHTML = `
      <div class="no-posts-message">
        <i class="far fa-image"></i>
        <p>No notes yet</p>
      </div>
    `;
    return;
  }

  paceNotes.forEach(note => {
    const postItem = document.createElement('div');
    postItem.className = 'post-item';
    postItem.onclick = () => viewNote(note.id);

    if (note.images && note.images.length > 0) {
      postItem.innerHTML = `<img src="${note.images[0]}" alt="Note image">`;
    } else {
      postItem.innerHTML = `<div class="text-image">${note.title || 'Untitled'}</div>`;
    }

    postsContainer.appendChild(postItem);
  });
}

function savePaceNote() {
  try {
    console.log("savePaceNote() called");

    const titleEl = document.getElementById('pace-title');
    const editorEl = document.getElementById('pace-content');
    const mediaPreviewEl = document.getElementById('media-preview');
    const shareEl = document.getElementById('share-pace');

    if (!titleEl || !editorEl || !shareEl) {
      console.error("savePaceNote: missing DOM elements", {
        paceTitle: !!titleEl,
        paceContent: !!editorEl,
        sharePace: !!shareEl
      });
      alert('Save failed: page elements missing. Check console for details.');
      return;
    }

    const title = (titleEl.value || 'Untitled').trim();

    // --- ambil HTML content
    let content = editorEl.innerHTML.trim();
    console.log("[DEBUG savePaceNote] raw editorEl.innerHTML:", content);

    // --- normalisasi line breaks
    content = content
      .replace(/<div><br><\/div>/gi, '<br>') // div kosong = br
      .replace(/<div>/gi, '<br>')            // buka div = newline
      .replace(/<\/div>/gi, '')              // tutup div dihapus
      .replace(/<p>/gi, '')                  
      .replace(/<\/p>/gi, '<br>');

    // rapikan jika ada <br> ganda
    content = content.replace(/(<br>\s*){2,}/gi, '<br>');

    console.log("[DEBUG savePaceNote] after normalize:", content);

    // --- sanitasi inline attributes (jaga goal-ref)
    const tmp = document.createElement('div');
    tmp.innerHTML = content;

    // replace chip → goal-ref sebelum simpan
    tmp.querySelectorAll('.goal-chip').forEach(chip => {
      const goalId = chip.dataset.id;
      if (goalId) {
        const placeholder = document.createElement('span');
        placeholder.className = 'goal-ref';
        placeholder.dataset.id = goalId;
        chip.replaceWith(placeholder);
      }
    });

    content = tmp.innerHTML;
    console.log("[DEBUG savePaceNote] sanitized content:", content);

    const sharePublic = !!shareEl.checked;

    if (!content && uploadedImages.length === 0) {
      alert('Please write something or add images before saving.');
      return;
    }

    // --- build note object
    let note;
    if (editingNote) {
      if (!editingNote.id) editingNote.id = String(Date.now());
      note = {
        ...editingNote,
        id: String(editingNote.id),
        title,
        content,
        images: uploadedImages.slice(),
        shared: sharePublic,
        timestamp: new Date().toISOString()
      };
      paceNotes = paceNotes.filter(n => String(n.id) !== String(editingNote.id));
    } else {
      note = {
        id: String(Date.now()),
        title,
        content,
        images: uploadedImages.slice(),
        shared: sharePublic,
        timestamp: new Date().toISOString(),
        author: 'You',
        writingTime: 60 - (typeof timeLeft === 'number' ? timeLeft : 0)
      };
    }

    console.log("[DEBUG savePaceNote] final note object:", note);

    // --- simpan ke localStorage
    paceNotes.push(note);
    localStorage.setItem('paceNotes', JSON.stringify(paceNotes));
    localStorage.removeItem('editingNote');

    // --- reset editor
    editorEl.innerHTML = '';
    titleEl.value = '';
    if (mediaPreviewEl) mediaPreviewEl.innerHTML = '';
    uploadedImages = [];
    hideSaveWizard && hideSaveWizard();

    console.log("Note saved successfully", note);

    // --- redirect
    window.location.href = sharePublic ? 'home_feed.html' : 'diarylist.html';

  } catch (err) {
    console.error("savePaceNote error:", err);
    alert("An error occurred while saving. Check console for details.");
  }
}



/* make save available globally (do this after function declaration) */
window.savePaceNote = savePaceNote;


function loadDiaryList(filter = 'all') {
  let upgraded = false;

  // 🔥 Normalisasi diary lama supaya konsisten
  paceNotes.forEach(note => {
    if (!note.id) {
      note.id = String(Date.now()) + Math.random().toString(36).substr(2, 5);
      upgraded = true;
    }
    if (!note.timestamp) {
      note.timestamp = new Date().toISOString();
      upgraded = true;
    }
    if (!note.hasOwnProperty('shared')) {
      note.shared = false; // default private
      upgraded = true;
    }
    if (!note.author) {
      note.author = "You";
      upgraded = true;
    }
    if (!note.writingTime) {
      note.writingTime = 0;
      upgraded = true;
    }
  });

  if (upgraded) {
    localStorage.setItem('paceNotes', JSON.stringify(paceNotes));
  }

  

  const diaryList = document.getElementById('diary-list');
  if (!diaryList) return;

  diaryList.innerHTML = '';

  let filteredNotes = paceNotes;
  if (filter === 'public') {
    filteredNotes = paceNotes.filter(note => note.shared === true);
  } else if (filter === 'private') {
    filteredNotes = paceNotes.filter(note => note.shared === false);
  }

  if (filteredNotes.length === 0) {
    diaryList.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-book-open"></i>
        <h3>No diaries found</h3>
        <p>Get started by creating your first diary entry</p>
      </div>
    `;
    return;
  }

  filteredNotes.forEach(note => {
    const diaryItem = document.createElement('div');
    diaryItem.className = 'diary-item';
    diaryItem.dataset.id = note.id;

    let statusClass = note.shared ? 'public' : 'private';
    let statusText = note.shared ? 'Public' : 'Private';

    const noteDate = new Date(note.timestamp);
    const formattedDate = isNaN(noteDate.getTime())
      ? "Unknown date"
      : noteDate.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        });

    // 🔥 Sanitize content diary
    // Sanitize + sync goals, pakai plain text
    let rawHTML = renderDiaryWithGoalText(note.content || "");


    rawHTML = rawHTML.replace(/\s*_ngcontent-[^=\s]+="[^"]*"/gi, "");
    rawHTML = rawHTML
      .replace(/<\/p>/gi, "<br>")
      .replace(/<\/div>/gi, "<br>")
      .replace(/<p[^>]*>/gi, "")
      .replace(/<div[^>]*>/gi, "");

    // Potong jadi 2 baris
    let lines = rawHTML
      .split(/<br\s*\/?>/i)
      .map(l => l.replace(/^\s+|\s+$/g, ""))
      .filter(l => l);

    let previewText = lines.length <= 2
      ? lines.join("<br>")
      : lines.slice(0, 2).join("<br>") + "<br>...";

    // PATCH: replace prefix di previewText
    previewText = replaceGoalPrefixInPreview(previewText);

    // Render diary card
    diaryItem.innerHTML = `
      <div class="diary-header">
        <div class="diary-title">${note.title || 'Untitled'}</div>
        <div class="diary-status ${statusClass}">${statusText}</div>
      </div>
      <div class="diary-preview" style="white-space: pre-wrap;">${previewText}</div>
      <div class="diary-footer">
        <div class="diary-date">${formattedDate}</div>
        <div class="diary-actions">
          <button class="diary-action-btn edit-btn" data-id="${note.id}">Edit</button>
          <button class="diary-action-btn delete-btn" data-id="${note.id}">Delete</button>
        </div>
      </div>
    `;

    // setelah diaryItem.innerHTML dibuat
    const previewEl = diaryItem.querySelector('.diary-preview');
    if (previewEl) {
      previewEl.querySelectorAll('.goal-chip').forEach(node => {
        const goalId = node.dataset.id;
        const goal = agendaGoals.find(g => g.id === goalId);
        if (goal) {
          node.replaceWith(createGoalChip(goal));
        }
      });
    }

    diaryList.appendChild(diaryItem);
  });

  // Pasang listener edit/delete
  document.querySelectorAll(".edit-btn").forEach(btn => {
    btn.addEventListener("click", e => {
      editDiary(e.target.dataset.id);
    });
  });
  document.querySelectorAll(".delete-btn").forEach(btn => {
    btn.addEventListener("click", e => {
      deleteDiary(e.target.dataset.id);
    });
  });
}




// Edit diary function
function editDiary(noteId) {
  const noteIndex = paceNotes.findIndex(note => note.id == noteId);
  if (noteIndex !== -1) {
    localStorage.setItem('editingNote', JSON.stringify(paceNotes[noteIndex]));
    window.location.href = 'diary.html';
  }
}




function deleteDiary(noteId) {
  if (confirm('Are you sure you want to delete this diary?')) {
    paceNotes = paceNotes.filter(note => String(note.id) !== String(noteId));
    localStorage.setItem('paceNotes', JSON.stringify(paceNotes));
    loadDiaryList(); // Reload the list
  }
}

// Setup filter buttons
function setupDiaryFilters() {
  const filterButtons = document.querySelectorAll('.filter-btn');
  
  filterButtons.forEach(button => {
    button.addEventListener('click', function() {
      // Remove active class from all buttons
      filterButtons.forEach(btn => btn.classList.remove('active'));
      
      // Add active class to clicked button
      this.classList.add('active');
      
      // Load diaries with selected filter
      const filter = this.dataset.filter;
      loadDiaryList(filter);
    });
  });
}


function renderMediaPreview() {
  const mediaPreviewEl = document.getElementById('media-preview');
  if (!mediaPreviewEl) {
    console.warn("Render media preview called but not available");
    return;
  }

  mediaPreviewEl.innerHTML = '';
  uploadedImages.forEach((src, idx) => {
    const img = document.createElement('img');
    img.src = src;
    img.className = 'preview-image';

    const delBtn = document.createElement('button');
    delBtn.textContent = '×';
    delBtn.className = 'delete-preview';
    delBtn.addEventListener('click', () => {
      uploadedImages.splice(idx, 1);
      renderMediaPreview();
    });

    const wrapper = document.createElement('div');
    wrapper.className = 'preview-wrapper';
    wrapper.appendChild(img);
    wrapper.appendChild(delBtn);

    mediaPreviewEl.appendChild(wrapper);
  });
}



// ===== PATCH: Fungsi setupPasteHandler jika belum ada =====
function setupPasteHandler() {
  const editor = document.getElementById('pace-content');
  if (!editor) return;

  editor.addEventListener('paste', function(e) {
    e.preventDefault();
    
    // Get pasted text
    const text = (e.clipboardData || window.clipboardData).getData('text/plain');
    
    // Insert text at cursor position
    document.execCommand('insertText', false, text);
  });
}

function applyFormat(command) {
  document.execCommand(command, false, null);
}

function viewDiaryDetail(diaryId) {
    window.location.href = `detail_diary.html?id=${diaryId}`;
}
window.viewDiaryDetail = viewDiaryDetail;

// Ganti fungsi adjustFloatingActions yang sudah ada dengan yang ini
function adjustFloatingActions() {
  const fa = document.getElementById("floating-actions");
  if (!fa) return;

  // Pastikan floating action bar memiliki style yang benar
  fa.style.position = 'fixed';
  fa.style.bottom = '0';
  fa.style.left = '0';
  fa.style.width = '100%';
  fa.style.zIndex = '1000';

  // Gunakan Visual Viewport API jika tersedia
  if (window.visualViewport) {
    const visualViewport = window.visualViewport;
    
    // Fungsi untuk mengupdate posisi
    const updatePosition = () => {
      // Dapatkan tinggi viewport yang terlihat
      const viewportHeight = visualViewport.height;
      // Hitung offset dari atas
      const offsetTop = visualViewport.offsetTop;
      // Hitung posisi bottom yang benar
      const bottom = Math.max(0, window.innerHeight - visualViewport.height - visualViewport.offsetTop);
      
      // Atur posisi floating action
      fa.style.bottom = `${bottom}px`;
    };

    // Update posisi saat viewport berubah
    visualViewport.addEventListener("resize", updatePosition);
    visualViewport.addEventListener("scroll", updatePosition);
    
    // Panggil sekali di awal
    updatePosition();
  } else {
    // Fallback untuk browser yang tidak mendukung Visual Viewport API
    window.addEventListener("resize", function() {
      // Logika fallback sederhana
      fa.style.bottom = '0';
    });
  }
}

// ...existing code...

let currentDiaryId = null;

function goBack() {
    window.history.back();
}

function loadDiaryDetail() {
  console.log("[DEBUG] loadDiaryDetail called");

  const urlParams = new URLSearchParams(window.location.search);
  currentDiaryId = urlParams.get('id');
  console.log("[DEBUG] diaryId from URL:", currentDiaryId);

  if (!currentDiaryId) {
    alert('Diary tidak ditemukan');
    return;
  }
  const paceNotes = JSON.parse(localStorage.getItem('paceNotes')) || [];
  console.log("[DEBUG] paceNotes loaded:", paceNotes);

  const diary = paceNotes.find(note => note.id === currentDiaryId);
  console.log("[DEBUG] diary found:", diary);

  if (!diary) {
    alert('Diary tidak ditemukan');
    return;
  }

  const contentEl = document.getElementById('diary-content');
  contentEl.innerHTML = renderDiaryWithGoals(diary.content || '');

  // 🔥 Debug chips
  const chips = contentEl.querySelectorAll('.goal-chip');
  console.log("[DEBUG] chips found in diary-content:", chips.length);
  chips.forEach((chip, idx) => {
    console.log(`[DEBUG] chip[${idx}] raw outerHTML:`, chip.outerHTML);
    console.log(`[DEBUG] chip[${idx}] dataset.id:`, chip.dataset.id);
  });

  // 🔥 Debug agendaGoals
  console.log("[DEBUG] agendaGoals in localStorage:", agendaGoals);

  chips.forEach(node => {
    const goalId = node.dataset.id;
    const goal = agendaGoals.find(g => String(g.id) === String(goalId));
    if (goal) {
      console.log("[DEBUG] Found matching goal for chip:", goal);
      node.replaceWith(createGoalChip(goal));
    } else {
      console.warn("[DEBUG] No matching goal found for chip id:", goalId);
    }
  });

  // render media
  const mediaContainer = document.getElementById('diary-media');
  mediaContainer.innerHTML = '';
  if (diary.images && diary.images.length > 0) {
    if (diary.images.length === 1) {
      mediaContainer.innerHTML = `
          <div class="media-single">
            <img src="${diary.images[0]}" alt="Diary image">
          </div>
        `;
    } else {
      let mediaHTML = '<div class="media-grid">';
      diary.images.forEach(img => {
        mediaHTML += `<img src="${img}" alt="Diary image">`;
      });
      mediaHTML += '</div>';
      mediaContainer.innerHTML = mediaHTML;
    }
  }

  updateInteractionUI(currentDiaryId);
  loadComments(currentDiaryId);
  setupInteractionListeners();
}


function setupInteractionListeners() {
    document.getElementById('like-btn-detail').addEventListener('click', () => {
        handleLike(currentDiaryId);
    });
    document.getElementById('bookmark-btn-detail').addEventListener('click', () => {
        handleBookmark(currentDiaryId);
    });
    document.getElementById('comment-btn-detail').addEventListener('click', () => {
        focusCommentInput();
    });
}

function focusCommentInput() {
    document.getElementById('comment-input').focus();
}

function submitComment() {
    const commentInput = document.getElementById('comment-input');
    const commentText = commentInput.value.trim();
    if (commentText) {
        addComment(currentDiaryId, commentText);
        commentInput.value = '';
    }
}

// Expose to global scope
window.goBack = goBack;
window.loadDiaryDetail = loadDiaryDetail;
window.setupInteractionListeners = setupInteractionListeners;
window.focusCommentInput = focusCommentInput;
window.submitComment = submitComment;
window.currentDiaryId = currentDiaryId; // for debugging if needed



// Panggil fungsi saat DOMContentLoaded
document.addEventListener("DOMContentLoaded", function() {
  // Panggil setelah delay kecil untuk memastikan semua element sudah terrender
  setTimeout(adjustFloatingActions, 100);
});

document.addEventListener("DOMContentLoaded", adjustFloatingActions);



// Initialize the app
document.addEventListener('DOMContentLoaded', function() {
  console.log('PaceNote initialized');

  // ===== PATCH: Pastikan variabel editingNote selalu didefinisikan =====
  window.editingNote = JSON.parse(localStorage.getItem('editingNote')) || null;
  // ===== END PATCH =====

  if (window.location.pathname.endsWith('home_feed.html')) {
    loadFeed();
  } else if (window.location.pathname.endsWith('profile.html')) {
    loadProfileGrid();
  } else if (window.location.pathname.endsWith('agenda.html')) {
    loadAgendaGoals();
  } else if (window.location.pathname.endsWith('diarylist.html')) {
    loadDiaryList();
    setupDiaryFilters();
  } else if (window.location.pathname.endsWith('diary.html')) {
    // ===== PATCH: Pastikan fungsi dijalankan dalam urutan yang benar =====
    setTimeout(function() {
      // Setup fungsi editor terlebih dahulu
 
      setupPasteHandler();

      setupMediaUpload();
  

    // safe bind: tombol Save di save-wizard
    const wizardSaveBtn = document.querySelector('#save-wizard .save-btn');
    if (wizardSaveBtn) {
      wizardSaveBtn.removeAttribute('onclick');
      wizardSaveBtn.addEventListener('click', savePaceNote);
    }

    // optional: jika ada tombol floating yang seharusnya membuka wizard
    const floatingSaveBtn = document.getElementById('save-button');
    if (floatingSaveBtn) {
      floatingSaveBtn.addEventListener('click', showSaveWizard);
    }

    const boldBtn = document.getElementById('bold-btn');
    const italicBtn = document.getElementById('italic-btn');
    const underlineBtn = document.getElementById('underline-btn');

    if (boldBtn) boldBtn.addEventListener('click', () => applyFormat('bold'));
    if (italicBtn) italicBtn.addEventListener('click', () => applyFormat('italic'));
    if (underlineBtn) underlineBtn.addEventListener('click', () => applyFormat('underline'));




      
      // Load data editing jika ada
      if (window.editingNote) {
        document.getElementById('pace-title').value = window.editingNote.title || '';
        const syncedContent = renderDiaryWithGoals(window.editingNote.content || '');
        document.getElementById('pace-content').innerHTML = syncedContent;
        document.getElementById('share-pace').checked = !!window.editingNote.shared;

        if (window.editingNote.images) {
          uploadedImages = window.editingNote.images;
          renderMediaPreview();
        }

        document.getElementById('save-button').classList.remove('hidden');
        document.getElementById('timer').textContent = "Edit Mode";
      } else {
        startTimer();
      }
    }, 100);
  if (window.editingNote) {
    document.getElementById('pace-title').value = window.editingNote.title || '';
    const syncedContent = renderDiaryWithGoals(window.editingNote.content || '');
    document.getElementById('pace-content').innerHTML = syncedContent;
    document.getElementById('share-pace').checked = !!window.editingNote.shared;

    if (window.editingNote.images) {
      uploadedImages = window.editingNote.images;
      renderMediaPreview();
    }

    document.getElementById('save-button').classList.remove('hidden');
    document.getElementById('timer').textContent = "Edit Mode";
  } else {
    startTimer();
  }

    // ===== END PATCH =====
  }
});

// PATCH: replace all goal lines in previewText agar prefix konsisten
function replaceGoalPrefixInPreview(text) {

  return text;
}


document.addEventListener('DOMContentLoaded', function() {
  const addGoalBtn = document.getElementById('add-goal-btn');
  const goalInputBox = document.getElementById('goal-input-box');
  const goalInput = document.getElementById('goal-input');
  const editor = document.getElementById('pace-content');
  const floatingActions = document.getElementById('floating-actions');

  // === PATCH: Prefix karakter/emoji untuk goals ===
  // Daftar pilihan karakter/emoji
  const goalPrefixOptions = ['()', '✓', '⭐', '•', '☑️', '🔹', '🟧', '📝', '🔖', '❗'];
  // Ambil dari localStorage atau default
  let goalPrefixChar = localStorage.getItem('goalPrefixChar') || '()';

  // Tambahkan tombol picker di samping input box (sekali saja)
  let prefixPicker = document.getElementById('goal-prefix-picker');
  if (!prefixPicker) {
    prefixPicker = document.createElement('button');
    prefixPicker.id = 'goal-prefix-picker';
    prefixPicker.type = 'button';
    prefixPicker.textContent = goalPrefixChar;
    prefixPicker.title = 'Ganti karakter/emoji pendamping goal';
    prefixPicker.style.marginLeft = '8px';
    prefixPicker.style.fontSize = '18px';
    prefixPicker.style.cursor = 'pointer';
    prefixPicker.style.border = '1px solid #FF9800';
    prefixPicker.style.background = '#fff';
    prefixPicker.style.borderRadius = '4px';
    prefixPicker.style.padding = '2px 8px';
    prefixPicker.style.height = '32px';
    prefixPicker.style.display = 'flex';
    prefixPicker.style.alignItems = 'center';

    // Buat popup pilihan emoji
    let popup = document.createElement('div');
    popup.id = 'goal-prefix-popup';
    popup.style.position = 'absolute';
    popup.style.background = '#fff';
    popup.style.border = '1px solid #FF9800';
    popup.style.borderRadius = '6px';
    popup.style.boxShadow = '0 2px 8px rgba(0,0,0,0.12)';
    popup.style.padding = '6px 8px';
    popup.style.display = 'none';
    popup.style.zIndex = '3000';
    popup.style.top = '40px';
    popup.style.left = '0';
    popup.style.whiteSpace = 'nowrap';

    goalPrefixOptions.forEach(opt => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = opt;
      btn.style.fontSize = '18px';
      btn.style.margin = '2px 4px';
      btn.style.padding = '2px 6px';
      btn.style.border = 'none';
      btn.style.background = 'none';
      btn.style.cursor = 'pointer';
      btn.style.borderRadius = '4px';
      if (opt === goalPrefixChar) btn.style.background = '#FFE0B2';
      btn.addEventListener('click', function() {
        goalPrefixChar = opt;
        localStorage.setItem('goalPrefixChar', goalPrefixChar);
        prefixPicker.textContent = goalPrefixChar;
        // Highlight terpilih
        Array.from(popup.children).forEach(child => child.style.background = 'none');
        btn.style.background = '#FFE0B2';
        popup.style.display = 'none';
      });
      popup.appendChild(btn);
    });

    prefixPicker.addEventListener('click', function(e) {
      e.stopPropagation();
      // Toggle popup
      popup.style.display = popup.style.display === 'none' ? 'block' : 'none';
      // Posisi popup
      const rect = prefixPicker.getBoundingClientRect();
      popup.style.left = '0px';
      popup.style.top = (rect.height + 4) + 'px';
    });

    // Tutup popup jika klik di luar
    document.addEventListener('mousedown', function(e) {
      if (!popup.contains(e.target) && e.target !== prefixPicker) {
        popup.style.display = 'none';
      }
    });

    // Sisipkan ke input box
    goalInputBox.appendChild(prefixPicker);
    goalInputBox.appendChild(popup);
  }

  // Simpan range caret terakhir di editor
  let lastSelectionRange = null;

  // Update lastSelectionRange setiap user klik/ketik di editor
  function saveCaretPosition() {
    try {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        // cloneRange supaya tidak hilang setelah DOM berubah
        lastSelectionRange = sel.getRangeAt(0).cloneRange();
      }
    } catch (err) {
      console.warn("Failed to save caret position:", err);
      lastSelectionRange = null; // reset supaya tidak pakai range invalid
    }
  }

  editor.addEventListener('keyup', saveCaretPosition);
  editor.addEventListener('mouseup', saveCaretPosition);
  editor.addEventListener('blur', saveCaretPosition);
  editor.addEventListener('focus', saveCaretPosition);

  function showGoalInputBox() {
    // Restore selection ke posisi caret terakhir
    if (lastSelectionRange) {
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(lastSelectionRange);
    } else {
      editor.focus();
    }

    // Buat marker span untuk dapatkan posisi caret
    let sel = window.getSelection();
    if (!sel.rangeCount) return;
    let range = sel.getRangeAt(0).cloneRange();

    const marker = document.createElement('span');
    marker.id = 'goal-caret-marker';
    marker.textContent = '\u200b'; // zero-width space
    range.insertNode(marker);

    // Ambil posisi marker
    const rect = marker.getBoundingClientRect();

    // Ambil bounding editor
    const editorRect = editor.getBoundingClientRect();

    // Ukuran input box
    goalInputBox.style.visibility = 'hidden';
    goalInputBox.classList.remove('hidden');
    const boxWidth = goalInputBox.offsetWidth;
    const boxHeight = goalInputBox.offsetHeight;
    goalInputBox.classList.add('hidden');
    goalInputBox.style.visibility = '';

    // Hitung posisi default (kanan kursor)
    let left = rect.left + window.scrollX + 10;
    let top = rect.top + window.scrollY - boxHeight / 2;

    // Koreksi jika keluar dari kanan editor/viewport
    const maxRight = Math.min(editorRect.right, window.innerWidth) + window.scrollX;
    if (left + boxWidth > maxRight) {
      left = maxRight - boxWidth - 8; // 8px padding
    }
    // Koreksi jika keluar dari kiri editor
    const minLeft = editorRect.left + window.scrollX + 8;
    if (left < minLeft) {
      left = minLeft;
    }
    // Koreksi jika keluar dari atas viewport
    const minTop = editorRect.top + window.scrollY + 8;
    if (top < minTop) {
      top = minTop;
    }
    // Koreksi jika keluar dari bawah editor/viewport
    const maxBottom = Math.min(editorRect.bottom, window.innerHeight) + window.scrollY;
    if (top + boxHeight > maxBottom) {
      top = maxBottom - boxHeight - 8;
    }

    // Tempatkan input box
    goalInputBox.style.position = 'absolute';
    goalInputBox.style.left = left + 'px';
    goalInputBox.style.top = top + 'px';
    goalInputBox.classList.remove('hidden');
    goalInput.value = '';
    goalInput.focus();

    // Hapus marker setelah dipakai
    marker.parentNode.removeChild(marker);
  }


  function hideGoalInputBox() {
    goalInputBox.classList.add('hidden');
    // Tutup popup jika terbuka
    const popup = document.getElementById('goal-prefix-popup');
    if (popup) popup.style.display = 'none';
  }

  addGoalBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    showGoalInputBox();
  });

  // Submit goal saat Enter → render sebagai CHIP (dengan logika lama)
  goalInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && goalInput.value.trim() !== '') {
      e.preventDefault();
      const goalText = goalInput.value.trim();

      const newGoal = {
        id: Date.now() + Math.random().toString(36).substr(2, 9),
        text: goalText,
        prefix: goalPrefixChar,
        completed: false,
        createdAt: new Date().toISOString(),
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'active' // PATCH: tambahkan status
      };
      agendaGoals.push(newGoal);
      localStorage.setItem('agendaGoals', JSON.stringify(agendaGoals));

      // PATCH: juga tambahkan ke diaryGoals
      diaryGoals.push({
        id: newGoal.id,
        text: newGoal.text,
        status: 'active'
      });

      hideGoalInputBox();
      showAgendaDetectionNotification([goalText]);
      if (typeof loadAgendaGoals === 'function') loadAgendaGoals();

      if (editor) {
        editor.focus();

        setTimeout(() => {
          if (lastSelectionRange) {
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(lastSelectionRange);
          }

          const sel = window.getSelection();
          if (!sel.rangeCount) return;
          const range = sel.getRangeAt(0);

          const goalWrapper = document.createElement('div');
          goalWrapper.className = 'goal-line';
          goalWrapper.appendChild(createGoalChip(newGoal));

          let currentLine = range.startContainer;
          if (currentLine.nodeType === 3 || currentLine.nodeName === 'BR') {
            currentLine = currentLine.parentNode;
          }
          while (currentLine && currentLine !== editor && currentLine.parentNode !== editor) {
            currentLine = currentLine.parentNode;
          }
          if (!currentLine || currentLine === editor) {
            currentLine = editor.lastChild;
          }

          let rawHTML = "";
          if (currentLine) {
            if (currentLine.nodeType === 1) {
              rawHTML = (currentLine.innerHTML || "")
                .replace(/<br\s*\/?>/gi, "")
                .trim();
            } else if (currentLine.nodeType === 3) {
              rawHTML = (currentLine.textContent || "").trim();
            }
          }
          const isEmptyLine = !rawHTML;

          if (isEmptyLine && currentLine && currentLine.parentNode === editor) {
            editor.replaceChild(goalWrapper, currentLine);
          } else {
            if (currentLine && currentLine.parentNode === editor) {
              editor.insertBefore(goalWrapper, currentLine.nextSibling);
            } else {
              editor.appendChild(goalWrapper);
            }
          }

          const emptyLine = document.createElement('div');
          emptyLine.innerHTML = '<br>';
          editor.insertBefore(emptyLine, goalWrapper.nextSibling);

          const newRange = document.createRange();
          newRange.setStart(emptyLine, 0);
          newRange.collapse(true);
          sel.removeAllRanges();
          sel.addRange(newRange);

          lastSelectionRange = newRange.cloneRange();
        }, 0);
      }
    } else if (e.key === 'Escape') {
      hideGoalInputBox();
    }
  });









  // Fungsi bantu untuk insert text di posisi kursor pada contenteditable
  function insertTextAtCursor(editableDiv, text) {
    let sel, range;
    if (window.getSelection) {
      sel = window.getSelection();
      if (sel.getRangeAt && sel.rangeCount) {
        range = sel.getRangeAt(0);
        range.deleteContents();
        const textNode = document.createTextNode(text);
        range.insertNode(textNode);
        // Pindahkan kursor setelah text yang baru
        range.setStartAfter(textNode);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
      }
    }
  }

  // Klik di luar box akan menutup input
  document.addEventListener('mousedown', function(e) {
    if (!goalInputBox.contains(e.target) && !addGoalBtn.contains(e.target)) {
      hideGoalInputBox();
    }
  });

});


