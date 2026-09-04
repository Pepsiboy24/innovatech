/**
 * ai_assistant.js
 * ─────────────────────────────────────────────────────────────────
 * Powers the EduHub AI Assistant for teachers.
 * Uses the Gemini API (gemini-2.0-flash) for responses, proxied
 * through the supabase/functions/gemini-proxy Edge Function so the
 * API key never reaches the browser.
 *
 * HOW TO SET YOUR API KEY:
 *   Set it as a Supabase Edge Function secret named GEMINI_API_KEY.
 *   Get one free at: https://aistudio.google.com/app/apikey
 */

import { supabase } from '../../core/config.js';

/* ── DOM ─────────────────────────────────────────────────────────── */
const greetingWrapper = document.getElementById('greetingWrapper');
const promptChips = document.getElementById('promptChips');
const messagesArea = document.getElementById('messagesArea');
const chatInput = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');
const teacherNameEl = document.getElementById('teacherName');

/* ── State ───────────────────────────────────────────────────────── */
const history = []; // { role: 'user'|'model', parts: [{text}] }
let hasStarted = false;
let isLoading = false;

/* ── System prompt injected at the start of every conversation ───── */
const SYSTEM_PROMPT = `You are EduHub AI, a helpful and knowledgeable teaching assistant for the EduHub school management platform.
Your primary goal is to assist teachers with lesson planning, creating quiz questions, drafting report comments, explaining concepts, and other classroom-related tasks.
Be concise, professional, and supportive. Format longer responses with clear headings or bullet points where helpful.
When asked to create lesson plans or assessments, structure them clearly and practically.`;

/* ── Init: fetch teacher name ────────────────────────────────────── */
async function init() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: teacher } = await supabase
        .from('Teachers')
        .select('first_name')
        .eq('teacher_id', user.id)
        .maybeSingle();

    if (teacher?.first_name) {
        teacherNameEl.textContent = teacher.first_name;
    }
}

/* ── Auto-height textarea ────────────────────────────────────────── */
function autoResize() {
    chatInput.style.height = 'auto';
    const maxH = 5 * 1.5 * 15 + 12; // 5 lines × line-height × font-size + padding
    chatInput.style.height = Math.min(chatInput.scrollHeight, maxH) + 'px';
}

chatInput.addEventListener('input', autoResize);

chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
    }
});

/* ── Prompt chips → pre-fill textarea ───────────────────────────── */
document.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
        chatInput.value = chip.dataset.prompt;
        autoResize();
        chatInput.focus();
    });
});

sendBtn.addEventListener('click', handleSend);

/* ── Send logic ─────────────────────────────────────────────────── */
async function handleSend() {
    const text = chatInput.value.trim();
    if (!text || isLoading) return;

    // First message — trigger layout transition
    if (!hasStarted) {
        hasStarted = true;
        greetingWrapper.classList.add('has-messages');
        promptChips.classList.add('hidden');
        setTimeout(() => {
            greetingWrapper.style.display = 'none'; // remove from flow after animation
            messagesArea.classList.add('visible');
        }, 500);
    }

    // Clear input
    chatInput.value = '';
    autoResize();

    // Show user bubble immediately
    appendBubble('user', text);

    // Add to history
    history.push({ role: 'user', parts: [{ text }] });

    // Show loader
    const loaderRow = appendLoader();
    isLoading = true;
    sendBtn.disabled = true;
    chatInput.disabled = true;

    try {
        const responseText = await callGemini();
        loaderRow.remove();
        appendBubble('ai', responseText);
        history.push({ role: 'model', parts: [{ text: responseText }] });
    } catch (err) {
        loaderRow.remove();
        appendBubble('ai', `⚠️ Sorry, something went wrong: ${err.message}`);
        console.error('[AI Assistant] Error:', err);
    } finally {
        isLoading = false;
        sendBtn.disabled = false;
        chatInput.disabled = false;
        chatInput.focus();
    }
}

/* ── Call Gemini API (via Supabase Edge Function) ────────────────── */
async function callGemini() {
    const { data, error } = await supabase.functions.invoke('gemini-proxy', {
        body: { messages: history, systemPrompt: SYSTEM_PROMPT }
    });

    if (error) {
        throw new Error(error.message || 'AI service unavailable');
    }

    return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? 'No response received.';
}

/* ── DOM helpers ─────────────────────────────────────────────────── */
function appendBubble(role, text) {
    const isUser = role === 'user';
    const row = document.createElement('div');
    row.className = `message-row ${role}`;

    const avatar = document.createElement('div');
    avatar.className = `avatar ${isUser ? 'user-avatar' : 'ai-avatar'}`;
    avatar.textContent = isUser ? '👤' : '✦';

    const bubble = document.createElement('div');
    bubble.className = 'bubble';

    if (isUser) {
        bubble.textContent = text;
    } else {
        // Render markdown-like formatting
        bubble.innerHTML = formatAIResponse(text);
    }

    if (isUser) {
        row.appendChild(bubble);
        row.appendChild(avatar);
    } else {
        row.appendChild(avatar);
        row.appendChild(bubble);
    }

    messagesArea.appendChild(row);
    scrollToBottom();
    return row;
}

function appendLoader() {
    const row = document.createElement('div');
    row.className = 'message-row ai';

    const avatar = document.createElement('div');
    avatar.className = 'avatar ai-avatar';
    avatar.textContent = '✦';

    const loader = document.createElement('div');
    loader.className = 'loader-bubble';
    loader.innerHTML = `
        <div class="loader-dot"></div>
        <div class="loader-dot"></div>
        <div class="loader-dot"></div>
    `;

    row.appendChild(avatar);
    row.appendChild(loader);
    messagesArea.appendChild(row);
    scrollToBottom();
    return row;
}

function scrollToBottom() {
    messagesArea.scrollTo({ top: messagesArea.scrollHeight, behavior: 'smooth' });
}

/* ── Lightweight markdown formatter ─────────────────────────────── */
function formatAIResponse(text) {
    return text
        // Code blocks
        .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
        // Inline code
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        // Bold
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        // Italic
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        // Headers (### ## #)
        .replace(/^### (.+)$/gm, '<h4 style="font-weight:600;margin:12px 0 6px;font-size:14px;">$1</h4>')
        .replace(/^## (.+)$/gm, '<h3 style="font-weight:600;margin:14px 0 8px;font-size:15px;">$1</h3>')
        .replace(/^# (.+)$/gm, '<h2 style="font-weight:700;margin:16px 0 10px;font-size:17px;">$1</h2>')
        // Bullet lists
        .replace(/^[•\-\*] (.+)$/gm, '<li>$1</li>')
        .replace(/(<li>[\s\S]+?<\/li>)/g, '<ul>$1</ul>')
        // Numbered lists
        .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
        // Paragraphs (double newlines)
        .replace(/\n\n/g, '</p><p>')
        // Single newlines
        .replace(/\n/g, '<br>')
        // Wrap in paragraph
        .replace(/^(.)/s, '<p>$1')
        .replace(/(.)$/s, '$1</p>');
}

/* ── Boot ────────────────────────────────────────────────────────── */
init();
