import useScrollShadows from "../hooks/useScrollShadows";
import { useRef,  useEffect, useState } from "react";
import { createConversation, getMyConversation, sendChatMessage, getApiMessage } from "../services/chatApi";
import { getSocket } from "../services/socket";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import {
  Activity,
  ArrowLeft,
  Bot,
  CalendarDays,
  CheckCircle2,
  Home,
  Send,
  Sparkles,
  Target,
  User,
  Utensils,
  Droplets,
  Dumbbell,
} from "lucide-react";

function Chat() {
  const sidebarRef = useRef(null);
  const { showTopShadow, showBottomShadow } = useScrollShadows(sidebarRef);

  const navigate = useNavigate();
  const { user: authUser } = useAuth();

  const [conversationId, setConversationId] = useState(null);

  const [messages, setMessages] = useState([
    {
      id: "welcome",
      sender: "ai",
      text:
        "Good evening! I'm your FitCoach AI. I can help you with your diet, workouts, progress and fitness goals.",
    },
  ]);

  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [chatError, setChatError] = useState("");

  const messagesEndRef = useRef(null);
  const localMessageIdRef = useRef(0);

  useEffect(() => {
  }, []);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return undefined;

    const handleRealtimeMessage = (payload) => {
      const incomingConversationId = payload?.conversationId;
      if (!incomingConversationId) return;

      if (conversationId && String(incomingConversationId) !== String(conversationId)) return;

      if (!conversationId) {
        setConversationId(incomingConversationId);
      }

      const incoming = (payload?.messages || [])
        .filter((message) => message?.role === "user" || message?.role === "assistant")
        .map((message) => ({
          id: message._id || `${message.createdAt}-${message.role}-${message.content}`,
          sender: message.role === "user" ? "user" : "ai",
          text: message.content,
        }));

      if (!incoming.length) return;

      setMessages((previous) => {
        const existingIds = new Set(previous.map((message) => String(message.id)));
        const existingTexts = new Set(previous.slice(-4).map((message) => `${message.sender}:${message.text}`));
        const next = incoming.filter((message) => {
          if (existingIds.has(String(message.id))) return false;
          if (existingTexts.has(`${message.sender}:${message.text}`)) return false;
          return true;
        });
        return next.length ? [...previous, ...next] : previous;
      });
    };

    socket.on("chat:message", handleRealtimeMessage);
    return () => socket.off("chat:message", handleRealtimeMessage);
  }, [conversationId]);

  useEffect(() => {
    let active = true;

    async function loadConversation() {
      try {
        const result = await getMyConversation();
        const conversation = result?.data?.conversation;
        if (!active) return;

        if (conversation) {
          setConversationId(conversation._id);
          const loaded = (conversation.messages || [])
            .filter((message) => message.role === "user" || message.role === "assistant")
            .map((message) => ({
              id: message._id || `${message.createdAt}-${message.role}`,
              sender: message.role === "user" ? "user" : "ai",
              text: message.content,
            }));

          if (loaded.length) {
            setMessages(loaded);
          }
        }
      } catch {
        // The welcome state remains usable until the first send attempt.
      }
    }

    loadConversation();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const socket = getSocket();
    if (!socket || !conversationId) return undefined;

    socket.emit("join-chat", conversationId);
    return () => socket.emit("leave-chat", conversationId);
  }, [conversationId]);

  /*
   * ============================================
   * AUTO SCROLL
   * ============================================
   */

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages, isTyping]);

  const firstName =
    authUser?.name?.split(" ")[0] || "there";

  /*
   * ============================================
   * SEND MESSAGE
   * ============================================
   */

  const sendMessage = async (question) => {
    const trimmedInput = question.trim();

    if (!trimmedInput || isTyping) {
      return;
    }

    const userMessage = {
      id: `local-user-${++localMessageIdRef.current}`,
      sender: "user",
      text: trimmedInput,
    };

    setMessages((previous) => [...previous, userMessage]);
    setInput("");
    setIsTyping(true);
    setChatError("");

    try {
      let activeConversationId = conversationId;

      if (!activeConversationId) {
        const created = await createConversation();
        activeConversationId = created?.data?.conversation?._id;
        setConversationId(activeConversationId || null);
      }

      const result = await sendChatMessage({
        conversationId: activeConversationId,
        message: trimmedInput,
      });

      const reply = result?.data?.reply;
      if (!reply) {
        throw new Error("The AI returned an empty response.");
      }

      setMessages((previous) => {
        const replyText = String(reply).trim();
        const alreadyPresent = previous.some(
          (message) =>
            message.sender === "ai" &&
            String(message.text || "").trim() === replyText
        );

        if (alreadyPresent) return previous;

        return [
          ...previous,
          {
            id: `local-ai-${++localMessageIdRef.current}`,
            sender: "ai",
            text: reply,
          },
        ];
      });

      if (result?.data?.conversation?._id) {
        setConversationId(result.data.conversation._id);
      }
    } catch (error) {
      const message = getApiMessage(error) || "I couldn't reach your AI coach right now. Please try again.";
      setChatError(message);
      setMessages((previous) => [
        ...previous,
        {
          id: `local-error-${++localMessageIdRef.current}`,
          sender: "ai",
          text: "I couldn't generate a response right now. Please check that the AI server is running and try again.",
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  /*
   * ============================================
   * SEND BUTTON
   * ============================================
   */

  const handleSend = () => {
    sendMessage(input);
  };

  /*
   * ============================================
   * ENTER KEY
   * ============================================
   */

  const handleKeyDown = (event) => {
    if (
      event.key === "Enter" &&
      !event.shiftKey
    ) {
      event.preventDefault();
      handleSend();
    }
  };

  /*
   * ============================================
   * QUICK QUESTIONS
   * ============================================
   */

  const quickQuestions = [
    {
      icon: <Utensils size={16} />,
      text: "Can I eat pizza?",
    },
    {
      icon: <Target size={16} />,
      text: "How much protein do I need?",
    },
    {
      icon: <Dumbbell size={16} />,
      text: "What's my workout schedule?",
    },
    {
      icon: <Droplets size={16} />,
      text: "How much water should I drink?",
    },
  ];

  const askQuickQuestion = (question) => {
    sendMessage(question);
  };

  return (
    <div className="chat-page">

      {/* =====================================
          SIDEBAR
      ====================================== */}

      <aside ref={sidebarRef} className="app-sidebar chat-sidebar">

        <div className="chat-logo">

          <div className="chat-logo-icon">
            <Activity size={20} />
          </div>

          <div>
            <strong>
              FitCoach AI
            </strong>

            <span>
              Smart Fitness
            </span>
          </div>

        </div>

        <nav className="chat-nav">

          <button
            className="chat-nav-item"
            onClick={() =>
              navigate("/dashboard")
            }
          >
            <Home size={18} />
            Dashboard
          </button>

          <button
            className="chat-nav-item"
            onClick={() =>
              navigate("/plan")
            }
          >
            <CalendarDays size={18} />
            My Plan
          </button>

          <button
            className="chat-nav-item"
            onClick={() =>
              navigate("/progress")
            }
          >
            <Activity size={18} />
            Progress
          </button>

          <button
            className="chat-nav-item active"
          >
            <Bot size={18} />
            AI Coach
          </button>

        </nav>

        <div className="chat-sidebar-bottom">

          <button
            className="chat-nav-item"
            onClick={() =>
              navigate("/profile")
            }
          >
            <User size={18} />
            Profile
          </button>

          <div className="chat-user">

            <div className="chat-avatar">
              {firstName
                .charAt(0)
                .toUpperCase()}
            </div>

            <div>
              <strong>
                {firstName}
              </strong>

              <span>
                Fitness Member
              </span>
            </div>

          </div>

        </div>

      </aside>

      {/* =====================================
          MAIN
      ====================================== */}

      <main className="chat-main">

        {/* ===================================
            HEADER
        ==================================== */}

        <header className="chat-header">

          <button
            className="chat-back-button"
            onClick={() =>
              navigate("/dashboard")
            }
          >
            <ArrowLeft size={17} />
            Dashboard
          </button>

          <div className="chat-header-center">

            {/* AI AVATAR */}

            <div className="chat-ai-avatar">

              <Sparkles size={20} />

              <span className="chat-ai-pulse" />

            </div>

            <div>

              <div className="chat-ai-title-row">

                <strong>
                  FitCoach AI
                </strong>

                <span className="chat-ai-badge">
                  AI
                </span>

              </div>

              <span>
                Your personal fitness coach
              </span>

            </div>

          </div>

          {/* ONLINE STATUS */}

          <div className="chat-online-status">

            <span className="chat-online-dot" />

            Online

          </div>

        </header>

        {/* ===================================
            CHAT CONTENT
        ==================================== */}

        <div className="chat-content">

          {/* =================================
              INTRO
          ================================== */}

          <section className="chat-intro">

            <div className="chat-intro-icon">

              <Sparkles size={22} />

              <span />

            </div>

            <div>

              <div className="chat-eyebrow">

                <Sparkles size={12} />

                AI FITNESS COACH

              </div>

              <h1>
                Your personal coach,
                <br />
                whenever you need it.
              </h1>

              <p>
                Ask me about your diet,
                workouts, progress or
                fitness goals.
              </p>

            </div>

          </section>

          {/* =================================
              AI STATUS CARD
          ================================== */}

          <div className="chat-ai-status-card">

            <div className="chat-ai-status-avatar">
              <Bot size={18} />
            </div>

            <div>

              <strong>
                FitCoach AI is ready
              </strong>

              <span>
                Context-aware fitness
                guidance based on your plan.
              </span>

            </div>

            <div className="chat-ai-live">

              <span />

              AI ACTIVE

            </div>

          </div>

          {chatError && (
            <div className="chat-error" role="alert">
              {chatError}
            </div>
          )}

          {/* =================================
              QUICK QUESTIONS
          ================================== */}

          <div className="chat-quick-section">

            <span className="chat-section-label">
              TRY ASKING
            </span>

            <div className="chat-quick-grid">

              {quickQuestions.map(
                (question) => (
                  <button
                    key={question.text}
                    className="chat-quick-button"
                    onClick={() =>
                      askQuickQuestion(
                        question.text
                      )
                    }
                    disabled={isTyping}
                  >

                    <span className="chat-quick-icon">
                      {question.icon}
                    </span>

                    <span>
                      {question.text}
                    </span>

                  </button>
                )
              )}

            </div>

          </div>

          {/* =================================
              MESSAGES
          ================================== */}

          <div className="chat-messages">

            {messages.map(
              (message) => (
                <div
                  key={message.id}
                  className={`chat-message-row ${
                    message.sender === "user"
                      ? "chat-message-user"
                      : "chat-message-ai"
                  }`}
                >

                  {/* AI AVATAR */}

                  {message.sender ===
                    "ai" && (
                    <div className="chat-message-avatar">

                      <Sparkles size={16} />

                      <span />

                    </div>
                  )}

                  <div
                    className={`chat-message-content ${
                      message.sender ===
                      "ai"
                        ? "chat-ai-message-content"
                        : ""
                    }`}
                  >

                    {/* AI GENERATED LABEL */}

                    {message.sender ===
                      "ai" && (
                      <div className="chat-generated-label">

                        <Sparkles size={10} />

                        AI GENERATED

                      </div>
                    )}

                    <div className="chat-message-bubble">

                      <p>
                        {message.text}
                      </p>

                    </div>

                  </div>

                  {/* USER AVATAR */}

                  {message.sender ===
                    "user" && (
                    <div className="chat-message-user-avatar">
                      {firstName
                        .charAt(0)
                        .toUpperCase()}
                    </div>
                  )}

                </div>
              )
            )}

            {/* =================================
                AI TYPING
            ================================== */}

            {isTyping && (
              <div className="chat-message-row chat-message-ai">

                <div className="chat-message-avatar">

                  <Sparkles size={16} />

                  <span />

                </div>

                <div className="chat-typing-wrapper">

                  <div className="chat-generated-label">

                    <Sparkles size={10} />

                    FITCOACH AI

                  </div>

                  <div className="chat-typing">

                    <span />
                    <span />
                    <span />

                  </div>

                  <small>
                    FitCoach AI is thinking...
                  </small>

                </div>

              </div>
            )}

            <div ref={messagesEndRef} />

          </div>

        </div>

        {/* ===================================
            INPUT AREA
        ==================================== */}

        <div className="chat-input-area">

          <div className="chat-input-container">

            <div className="chat-input-ai-icon">
              <Sparkles size={15} />
            </div>

            <textarea
              rows="1"
              value={input}
              placeholder="Ask your fitness coach..."
              onChange={(event) =>
                setInput(
                  event.target.value
                )
              }
              onKeyDown={
                handleKeyDown
              }
              disabled={isTyping}
            />

            <button
              className="chat-send-button"
              onClick={handleSend}
              disabled={
                !input.trim() ||
                isTyping
              }
              aria-label="Send message"
            >
              <Send size={18} />
            </button>

          </div>

          <div className="chat-input-footer">

            <div className="chat-disclaimer">

              <CheckCircle2 size={13} />

              AI fitness guidance is for
              general wellness and is not
              medical advice.

            </div>

            <div className="chat-powered">

              <Sparkles size={11} />

              Powered by FitCoach AI

            </div>

          </div>

        </div>

      </main>

    </div>
  );
}

export default Chat;