// --- Supabase Setup ---
const SUPABASE_URL = "https://dzotwozhcxzkxtunmqth.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR6b3R3b3poY3h6a3h0dW5tcXRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwODk5NzAsImV4cCI6MjA3MDY2NTk3MH0.KJfkrRq46c_Fo7ujkmvcue4jQAzIaSDfO3bU7YqMZdE";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- Global Dropdown State ---
let selectedValue = '';
let isOpen = false;
let currentOptions = [];
let searchInput, dropdownOptions, hiddenSelect, container;

// --- Initialization ---
document.addEventListener('DOMContentLoaded', function() {
  const createClassBtn = document.getElementById('createClassBtn');
  const modal = document.getElementById('createClassModal');

  if (createClassBtn && modal) {
    createClassBtn.addEventListener('click', function() {
      setTimeout(() => {
        container = document.querySelector('.searchable-dropdown');
        if (container && !container.dataset.initialized) {
          container.dataset.initialized = "true";
          setupDropdown(container);
        }
      }, 100);
    });
  }
});

// --- Setup Dropdown ---
function setupDropdown(containerElement) {
  searchInput = containerElement.querySelector('#teacherSearchInput');
  dropdownOptions = containerElement.querySelector('#teacherDropdownOptions');
  hiddenSelect = containerElement.querySelector('#teacherSelect');
  container = containerElement;

  bindEvents();
}

// --- Event Binding ---
function bindEvents() {
  // Input event
  searchInput.addEventListener('input', async (e) => {
    const searchTerm = e.target.value.trim();
    if (searchTerm === '') {
        closeDropdown();  // Close dropdown when input is empty
        currentOptions = [];  // Clear the options array
        renderOptions([]);  // Clear the displayed options
        return;
    }

    try {
      const { data: teachers, error } = await supabaseClient
        .from('Teachers')
        .select('teacher_id, first_name')
        .ilike('first_name', `%${searchTerm}%`);

      if (error) {
        console.error('Supabase search error:', error);
        closeDropdown();
        return;
      }

      if (teachers && teachers.length > 0) {
        currentOptions = teachers.map(t => ({
          value: t.teacher_id,
          text: t.first_name
        }));
        renderOptions(currentOptions, searchTerm);
        openDropdown();
      } else {
        renderOptions([], searchTerm);
        closeDropdown();
      }
    } catch (err) {
      console.error('Error fetching teachers:', err);
      closeDropdown();
    }
  });

  // Outside click closes dropdown
  document.addEventListener('click', (e) => {
    if (!container.contains(e.target)) closeDropdown();
  });

  // Keyboard navigation
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeDropdown();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (isOpen) highlightNextOption();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (isOpen) highlightPreviousOption();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (isOpen) selectHighlightedOption();
    }
  });
}

// --- UI Rendering + State ---
function openDropdown() {
  container.classList.add('open');
  isOpen = true;
}

function closeDropdown() {
  container.classList.remove('open');
  isOpen = false;
}

function renderOptions(options, searchTerm = '') {
  dropdownOptions.innerHTML = '';

  if (options.length === 0) {
    const noRes = document.createElement('div');
    noRes.className = 'dropdown-option no-results';
    noRes.textContent = 'No teachers found';
    dropdownOptions.appendChild(noRes);
    return;
  }

  options.forEach(opt => {
    const optionEl = document.createElement('div');
    optionEl.className = 'dropdown-option';
    optionEl.dataset.value = opt.value;

    // Highlight search term
    if (searchTerm) {
      const regex = new RegExp(`(${searchTerm})`, 'gi');
      optionEl.innerHTML = opt.text.replace(regex, '<mark>$1</mark>');
    } else {
      optionEl.textContent = opt.text;
    }

    optionEl.addEventListener('click', () => selectOption(opt));
    dropdownOptions.appendChild(optionEl);
  });
}

// --- Option Selection ---
function selectOption(option) {
  selectedValue = option.value;
  searchInput.value = option.text;
  hiddenSelect.value = option.value;
  closeDropdown();

  const event = new Event('change', { bubbles: true });
  hiddenSelect.dispatchEvent(event);
}

function highlightNextOption() {
  const options = dropdownOptions.querySelectorAll('.dropdown-option:not(.no-results)');
  if (options.length === 0) return;

  const currentIndex = Array.from(options).findIndex(opt => opt.classList.contains('highlighted'));
  if (currentIndex >= 0) options[currentIndex].classList.remove('highlighted');

  const nextIndex = currentIndex < options.length - 1 ? currentIndex + 1 : 0;
  options[nextIndex].classList.add('highlighted');
}

function highlightPreviousOption() {
  const options = dropdownOptions.querySelectorAll('.dropdown-option:not(.no-results)');
  if (options.length === 0) return;

  const currentIndex = Array.from(options).findIndex(opt => opt.classList.contains('highlighted'));
  if (currentIndex >= 0) options[currentIndex].classList.remove('highlighted');

  const prevIndex = currentIndex > 0 ? currentIndex - 1 : options.length - 1;
  options[prevIndex].classList.add('highlighted');
}

function selectHighlightedOption() {
  const highlighted = dropdownOptions.querySelector('.dropdown-option.highlighted');
  if (!highlighted) return;
  const value = highlighted.dataset.value;
  const text = highlighted.textContent;
  selectOption({ value, text });
}

// --- Helper functions for external usage ---
function getSelectedValue() {
  return selectedValue;
}

function setSelectedValue(value) {
  const option = currentOptions.find(opt => opt.value === value);
  if (option) selectOption(option);
}
