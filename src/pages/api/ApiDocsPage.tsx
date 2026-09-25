import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Logo } from '@/components/brand/Logo';
import {
  Shield,
  ArrowRight,
  Bot,
  Code2,
  Link2,
  Cpu,
  ExternalLink,
  FileText,
  Lock,
  Activity,
  BookOpen,
  ChevronRight,
} from 'lucide-react';

const developerStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=Source+Serif+4:opsz,wght@8..60,400;8..60,600&display=swap');

  .dev-page {
    --accent-emerald: #0d9488;
    --accent-emerald-light: #14b8a6;
    --accent-emerald-dark: #0f766e;
    --warm-cream: #faf8f5;
    --warm-stone: #f5f3ef;
    --charcoal: #1c1917;
    --charcoal-light: #44403c;
    font-family: 'Outfit', sans-serif;
  }

  .dev-page .font-display {
    font-family: 'Outfit', sans-serif;
  }

  .dev-page .font-serif {
    font-family: 'Source Serif 4', serif;
  }

  .dev-page .geo-grid {
    background-image:
      linear-gradient(rgba(13, 148, 136, 0.03) 1px, transparent 1px),
      linear-gradient(90deg, rgba(13, 148, 136, 0.03) 1px, transparent 1px);
    background-size: 60px 60px;
  }

  .dev-page .nav-glass {
    background: rgba(250, 248, 245, 0.8);
    backdrop-filter: blur(20px);
    border-bottom: 1px solid rgba(0, 0, 0, 0.05);
  }

  .dev-page .hero-gradient {
    background:
      radial-gradient(ellipse 80% 50% at 50% -20%, rgba(13, 148, 136, 0.15), transparent),
      radial-gradient(ellipse 60% 40% at 100% 50%, rgba(20, 184, 166, 0.1), transparent),
      radial-gradient(ellipse 50% 30% at 0% 80%, rgba(15, 118, 110, 0.08), transparent),
      linear-gradient(to bottom, var(--warm-cream), var(--warm-stone));
  }

  .dev-page .fade-in-up {
    opacity: 0;
    transform: translateY(30px);
    animation: devFadeInUp 0.8s ease-out forwards;
  }

  .dev-page .fade-in-up-delay-1 { animation-delay: 0.1s; }
  .dev-page .fade-in-up-delay-2 { animation-delay: 0.2s; }
  .dev-page .fade-in-up-delay-3 { animation-delay: 0.3s; }

  @keyframes devFadeInUp {
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .dev-page .feature-card {
    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    border: 1px solid rgba(0, 0, 0, 0.06);
  }

  .dev-page .feature-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.08);
    border-color: rgba(13, 148, 136, 0.2);
  }

  .dev-page .step-connector {
    background: linear-gradient(90deg, transparent, rgba(13, 148, 136, 0.3), transparent);
  }

  .dev-page .btn-shine {
    position: relative;
    overflow: hidden;
  }

  .dev-page .btn-shine::after {
    content: '';
    position: absolute;
    top: -50%;
    left: -50%;
    width: 200%;
    height: 200%;
    background: linear-gradient(
      to right,
      transparent,
      rgba(255, 255, 255, 0.3),
      transparent
    );
    transform: rotate(45deg) translateX(-100%);
    transition: transform 0.6s;
  }

  .dev-page .btn-shine:hover::after {
    transform: rotate(45deg) translateX(100%);
  }

  .dev-page .code-block {
    background: #1e1e2e;
    border-radius: 12px;
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  .dev-page .code-block-header {
    background: #181825;
    padding: 12px 16px;
    display: flex;
    align-items: center;
    gap: 8px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  .dev-page .code-block-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
  }

  .dev-page .code-block pre {
    padding: 20px;
    margin: 0;
    overflow-x: auto;
    font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
    font-size: 13px;
    line-height: 1.7;
    color: #cdd6f4;
  }

  .dev-page .code-keyword { color: #cba6f7; }
  .dev-page .code-string { color: #a6e3a1; }
  .dev-page .code-comment { color: #6c7086; }
  .dev-page .code-property { color: #89b4fa; }
  .dev-page .code-method { color: #f9e2af; }
  .dev-page .code-punctuation { color: #9399b2; }

  .dev-page .tool-row {
    transition: background 0.2s;
  }

  .dev-page .tool-row:hover {
    background: rgba(13, 148, 136, 0.04);
  }

  .dev-page .cta-gradient {
    background: linear-gradient(135deg, #0f766e 0%, #0d9488 50%, #14b8a6 100%);
  }
`;

interface McpTool {
  name: string;
  description: string;
}

interface ToolCategory {
  category: string;
  icon: React.ReactNode;
  tools: McpTool[];
}

const ApiDocsPage: React.FC = () => {
  const navigate = useNavigate();

  const toolCategories: ToolCategory[] = [
    {
      category: 'Transactions',
      icon: <Activity className="w-4 h-4" />,
      tools: [
        { name: 'search_transactions', description: 'Search transactions by postcode, principal, or status' },
        { name: 'get_transaction', description: 'Retrieve full transaction details by ID' },
        { name: 'get_status', description: 'Get current lifecycle status of a transaction' },
        { name: 'create_transaction', description: 'Create a new property transaction' },
        { name: 'join_transaction', description: 'Join an existing transaction with an invite code' },
        { name: 'get_transaction_chain', description: 'Get the full chain of linked transactions' },
        { name: 'next_step', description: 'Get the next recommended action and what is blocking the transaction' },
      ],
    },
    {
      category: 'Bot Access',
      icon: <Bot className="w-4 h-4" />,
      tools: [
        { name: 'join_transaction_as_bot', description: 'Join a transaction with the invite code the user shares' },
        { name: 'list_my_transactions', description: 'List every transaction this connection can access' },
        { name: 'list_connected_bots', description: 'List the bots connected to a transaction' },
      ],
    },
    {
      category: 'Documents',
      icon: <FileText className="w-4 h-4" />,
      tools: [
        { name: 'verify_document', description: 'Verify a document hash against the blockchain record' },
        { name: 'list_documents', description: 'List all documents for a given transaction' },
        { name: 'upload_document', description: 'Register a document hash proof on-chain' },
      ],
    },
    {
      category: 'Checklists',
      icon: <BookOpen className="w-4 h-4" />,
      tools: [
        { name: 'get_checklist', description: 'Retrieve the conveyancing checklist for a transaction' },
        { name: 'update_checklist', description: 'Mark checklist items as complete' },
      ],
    },
    {
      category: 'Property Intel',
      icon: <Cpu className="w-4 h-4" />,
      tools: [
        { name: 'get_property_intel', description: 'Get Land Registry data, price history, and title info' },
      ],
    },
    {
      category: 'Education',
      icon: <BookOpen className="w-4 h-4" />,
      tools: [
        { name: 'explain_process', description: 'Get plain-English explanations of conveyancing steps' },
        { name: 'send_message', description: 'Send a message within a transaction thread' },
      ],
    },
  ];

  const rbacRoles = [
    {
      role: 'BotPersonal',
      scope: 'Single user',
      description: 'Acts on behalf of one buyer or seller. Can read/write their own transactions only.',
    },
    {
      role: 'BotFirm',
      scope: 'Law firm',
      description: 'Acts on behalf of a solicitor firm. Access to all firm transactions and client data.',
    },
    {
      role: 'BotInternal',
      scope: 'Platform',
      description: 'Internal PropXchain bot. Read-only analytics, monitoring, and alerting.',
    },
  ];

  const quickLinks = [
    { title: 'llms.txt', description: 'Machine-readable platform overview', icon: FileText, href: '/llms.txt' },
    { title: 'llms-full.txt', description: 'Complete API surface and tool schemas', icon: Code2, href: '/llms-full.txt' },
    { title: 'auth.md', description: 'How agents connect and authenticate', icon: Bot, href: '/auth.md' },
    { title: 'conveyancing-guide.md', description: 'UK conveyancing process reference', icon: BookOpen, href: '/conveyancing-guide.md' },
    { title: 'mcp.json', description: 'Machine-readable connector manifest', icon: Cpu, href: '/.well-known/mcp.json' },
  ];

  return (
    <>
      <style>{developerStyles}</style>
      <div className="dev-page min-h-screen" style={{ background: 'var(--warm-cream)' }}>
        {/* Header */}
        <header className="nav-glass sticky top-0 z-50 w-full">
          <div className="container flex h-20 items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => navigate('/')} className="flex items-center gap-3">
                <Logo variant="mark" tone="onLight" to={null} className="h-11 w-auto" />
              </button>
              <span className="text-sm font-medium px-2.5 py-1 rounded-full bg-teal-50 text-teal-700 border border-teal-200 ml-2">
                Developers
              </span>
            </div>

            <nav className="flex items-center gap-4">
              <button
                onClick={() => navigate('/')}
                className="text-sm font-medium transition-colors hover:text-teal-600 hidden sm:block"
                style={{ color: 'var(--charcoal-light)' }}
              >
                Back to Home
              </button>
              <Button
                onClick={() => navigate('/login')}
                className="btn-shine bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 text-white shadow-lg shadow-teal-500/25 px-6"
              >
                Get Started
              </Button>
            </nav>
          </div>
        </header>

        <main>
          {/* Hero Section */}
          <section className="hero-gradient relative overflow-hidden">
            <div className="absolute inset-0 geo-grid opacity-50" />
            <div className="container relative z-10 py-20 sm:py-28 lg:py-36 px-4 sm:px-6">
              <div className="max-w-3xl mx-auto text-center fade-in-up">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-teal-50 border border-teal-200 mb-8">
                  <Code2 className="h-4 w-4 text-teal-600" />
                  <span className="text-sm font-medium text-teal-700">Developer Hub</span>
                </div>

                <h1
                  className="font-display text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold leading-[1.1] tracking-tight mb-6"
                  style={{ color: 'var(--charcoal)' }}
                >
                  Build on{' '}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-600 to-teal-500">
                    PropXchain
                  </span>
                </h1>

                <p
                  className="font-serif text-lg sm:text-xl lg:text-2xl leading-relaxed mb-10 max-w-2xl mx-auto"
                  style={{ color: 'var(--charcoal-light)' }}
                >
                  Connect your AI agent to the first bot-native property conveyancing platform.
                  Discover, connect, and act — all through open protocols.
                </p>

                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Button
                    size="lg"
                    onClick={() => navigate('/dashboard/bot-agents')}
                    className="btn-shine bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 text-white text-lg px-8 py-6 shadow-xl shadow-teal-500/25"
                  >
                    <Bot className="mr-2 h-5 w-5" />
                    Manage Bot Access
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    onClick={() => window.open('/auth.md', '_blank')}
                    className="text-lg px-8 py-6 border-2 hover:bg-teal-50 hover:border-teal-300"
                    style={{ color: 'var(--charcoal)', borderColor: 'rgba(0,0,0,0.15)' }}
                  >
                    <ExternalLink className="mr-2 h-5 w-5" />
                    Connection Guide
                  </Button>
                </div>
              </div>
            </div>
          </section>

          {/* Architecture Overview - 3 Steps */}
          <section className="py-20 sm:py-28" style={{ background: 'var(--warm-stone)' }}>
            <div className="container px-4 sm:px-6">
              <div className="text-center mb-16">
                <h2
                  className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold mb-6"
                  style={{ color: 'var(--charcoal)' }}
                >
                  How Bot Integration Works
                </h2>
                <p
                  className="font-serif text-lg sm:text-xl max-w-2xl mx-auto"
                  style={{ color: 'var(--charcoal-light)' }}
                >
                  Three steps from discovery to action. No SDK required.
                </p>
              </div>

              <div className="grid md:grid-cols-3 gap-6 sm:gap-8 relative">
                {/* Connector line */}
                <div className="hidden md:block absolute top-16 left-[16%] right-[16%] h-0.5 step-connector" />

                {[
                  {
                    step: 1,
                    icon: FileText,
                    title: 'Discover',
                    description:
                      'Your agent reads llms.txt to understand PropXchain\'s capabilities, canisters, and tools.',
                    color: 'from-teal-500 to-teal-600',
                  },
                  {
                    step: 2,
                    icon: Link2,
                    title: 'Connect',
                    description:
                      'Add https://mcp.propxchain.com/mcp as a connector, approve it with your PropXchain email, and use 18 tools.',
                    color: 'from-teal-600 to-teal-700',
                  },
                  {
                    step: 3,
                    icon: Cpu,
                    title: 'Act',
                    description:
                      'Search transactions, verify documents, track chains — all as the connection\'s own principal.',
                    color: 'from-teal-700 to-emerald-800',
                  },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.step} className="text-center relative">
                      <div
                        className={`w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-br ${item.color} text-white flex items-center justify-center shadow-xl shadow-teal-500/25 relative z-10`}
                      >
                        <Icon className="w-7 h-7" />
                      </div>
                      <div className="text-sm font-semibold text-teal-600 mb-2">Step {item.step}</div>
                      <h3
                        className="text-xl sm:text-2xl font-semibold mb-3"
                        style={{ color: 'var(--charcoal)' }}
                      >
                        {item.title}
                      </h3>
                      <p className="text-base" style={{ color: 'var(--charcoal-light)' }}>
                        {item.description}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          {/* Available MCP Tools */}
          <section className="py-20 sm:py-28 relative overflow-hidden">
            <div className="absolute inset-0 geo-grid opacity-30" />
            <div className="container relative z-10 px-4 sm:px-6">
              <div className="text-center mb-16">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-teal-50 border border-teal-200 mb-6">
                  <Cpu className="h-4 w-4 text-teal-600" />
                  <span className="text-sm font-medium text-teal-700">18 Tools Available</span>
                </div>
                <h2
                  className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold mb-6"
                  style={{ color: 'var(--charcoal)' }}
                >
                  MCP Tool Reference
                </h2>
                <p
                  className="font-serif text-lg sm:text-xl max-w-2xl mx-auto"
                  style={{ color: 'var(--charcoal-light)' }}
                >
                  Every tool your bot needs to participate in property transactions.
                </p>
              </div>

              <div className="max-w-4xl mx-auto space-y-8">
                {toolCategories.map((cat) => (
                  <Card
                    key={cat.category}
                    className="feature-card bg-white/80 backdrop-blur-sm rounded-2xl border-0 overflow-hidden"
                  >
                    <CardContent className="p-0">
                      <div className="flex items-center gap-3 px-6 py-4 border-b" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
                        <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center text-teal-600">
                          {cat.icon}
                        </div>
                        <h3 className="font-semibold text-lg" style={{ color: 'var(--charcoal)' }}>
                          {cat.category}
                        </h3>
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-teal-50 text-teal-700">
                          {cat.tools.length} {cat.tools.length === 1 ? 'tool' : 'tools'}
                        </span>
                      </div>
                      <div className="divide-y" style={{ borderColor: 'rgba(0,0,0,0.04)' }}>
                        {cat.tools.map((tool) => (
                          <div
                            key={tool.name}
                            className="tool-row flex flex-col sm:flex-row sm:items-start gap-1.5 sm:gap-4 px-6 py-3.5"
                          >
                            <code
                              className="self-start text-sm font-mono font-medium text-teal-700 bg-teal-50 px-2.5 py-1 rounded-md break-all sm:break-normal sm:whitespace-nowrap sm:flex-shrink-0"
                            >
                              propxchain_{tool.name}
                            </code>
                            <p className="text-sm pt-0.5" style={{ color: 'var(--charcoal-light)' }}>
                              {tool.description}
                            </p>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </section>

          {/* Code Examples */}
          <section className="py-20 sm:py-28" style={{ background: 'var(--warm-stone)' }}>
            <div className="container px-4 sm:px-6">
              <div className="text-center mb-16">
                <h2
                  className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold mb-6"
                  style={{ color: 'var(--charcoal)' }}
                >
                  Code Examples
                </h2>
                <p
                  className="font-serif text-lg sm:text-xl max-w-2xl mx-auto"
                  style={{ color: 'var(--charcoal-light)' }}
                >
                  From discovery to action in a few lines of code.
                </p>
              </div>

              <div className="max-w-3xl mx-auto space-y-8">
                {/* Example 1: Discover */}
                <div>
                  <h3 className="text-lg font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--charcoal)' }}>
                    <span className="w-7 h-7 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center text-sm font-bold">1</span>
                    Discover
                  </h3>
                  <div className="code-block">
                    <div className="code-block-header">
                      <div className="code-block-dot" style={{ background: '#f38ba8' }} />
                      <div className="code-block-dot" style={{ background: '#f9e2af' }} />
                      <div className="code-block-dot" style={{ background: '#a6e3a1' }} />
                      <span className="text-xs text-gray-400 ml-2">bash</span>
                    </div>
                    <pre>
                      <span className="code-comment"># Check if a platform supports AI agents</span>
{'\n'}<span className="code-method">curl</span> https://propxchain.com/llms.txt
                    </pre>
                  </div>
                </div>

                {/* Example 2: Connect & Search */}
                <div>
                  <h3 className="text-lg font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--charcoal)' }}>
                    <span className="w-7 h-7 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center text-sm font-bold">2</span>
                    Connect & Search
                  </h3>
                  <div className="code-block">
                    <div className="code-block-header">
                      <div className="code-block-dot" style={{ background: '#f38ba8' }} />
                      <div className="code-block-dot" style={{ background: '#f9e2af' }} />
                      <div className="code-block-dot" style={{ background: '#a6e3a1' }} />
                      <span className="text-xs text-gray-400 ml-2">typescript</span>
                    </div>
                    <pre>
                      <span className="code-comment">{'// Your MCP client runs the OAuth sign-in and sends this for you'}</span>{'\n'}
                      <span className="code-keyword">const</span> response = <span className="code-keyword">await</span> <span className="code-method">fetch</span>(<span className="code-string">'https://mcp.propxchain.com/mcp'</span>, {'{\n'}
                      {'  '}<span className="code-property">method</span>: <span className="code-string">'POST'</span>,{'\n'}
                      {'  '}<span className="code-property">headers</span>: {'{\n'}
                      {'    '}<span className="code-string">'Authorization'</span>: <span className="code-string">'Bearer '</span> + accessToken,{'\n'}
                      {'    '}<span className="code-string">'Content-Type'</span>: <span className="code-string">'application/json'</span>,{'\n'}
                      {'    '}<span className="code-string">'Accept'</span>: <span className="code-string">'application/json, text/event-stream'</span>,{'\n'}
                      {'  }\n'}
                      {'  '}<span className="code-property">body</span>: JSON.<span className="code-method">stringify</span>({'{\n'}
                      {'    '}<span className="code-property">jsonrpc</span>: <span className="code-string">'2.0'</span>, <span className="code-property">id</span>: 1,{'\n'}
                      {'    '}<span className="code-property">method</span>: <span className="code-string">'tools/call'</span>,{'\n'}
                      {'    '}<span className="code-property">params</span>: {'{\n'}
                      {'      '}<span className="code-property">name</span>: <span className="code-string">'propxchain_search_transactions'</span>,{'\n'}
                      {'      '}<span className="code-property">arguments</span>: {'{ '}<span className="code-property">postcode</span>: <span className="code-string">'SW1A 1AA'</span>{' }\n'}
                      {'    }\n'}
                      {'  })\n'}
                      {'}'});
                    </pre>
                  </div>
                </div>

                {/* Example 3: Security Model */}
                <div>
                  <h3 className="text-lg font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--charcoal)' }}>
                    <span className="w-7 h-7 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center text-sm font-bold">3</span>
                    Security Model
                  </h3>
                  <div className="code-block">
                    <div className="code-block-header">
                      <div className="code-block-dot" style={{ background: '#f38ba8' }} />
                      <div className="code-block-dot" style={{ background: '#f9e2af' }} />
                      <div className="code-block-dot" style={{ background: '#a6e3a1' }} />
                      <span className="text-xs text-gray-400 ml-2">diagram</span>
                    </div>
                    <pre>
                      <span className="code-method">MCP client</span> <span className="code-punctuation">-&gt;</span> <span className="code-string">OAuth 2.1 access token</span>{'\n'}
                      {'                    '}<span className="code-punctuation">|</span>{'\n'}
                      {'            '}<span className="code-method">MCP gateway</span> <span className="code-comment">(verifies token, checks the grant is live)</span>{'\n'}
                      {'                    '}<span className="code-punctuation">|</span>{'\n'}
                      {'        '}<span className="code-keyword">The connection's own ICP principal</span>{'\n'}
                      {'                    '}<span className="code-punctuation">|</span>{'\n'}
                      {'            '}<span className="code-method">ICP Canister</span>{'\n'}
                      {'    '}<span className="code-comment">(enforces access control natively)</span>
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Security & Trust */}
          <section className="py-20 sm:py-28 relative overflow-hidden">
            <div className="absolute inset-0 geo-grid opacity-30" />
            <div className="container relative z-10 px-4 sm:px-6">
              <div className="text-center mb-16">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-teal-50 border border-teal-200 mb-6">
                  <Shield className="h-4 w-4 text-teal-600" />
                  <span className="text-sm font-medium text-teal-700">Zero-Trust Architecture</span>
                </div>
                <h2
                  className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold mb-6"
                  style={{ color: 'var(--charcoal)' }}
                >
                  Security & Trust
                </h2>
                <p
                  className="font-serif text-lg sm:text-xl max-w-2xl mx-auto"
                  style={{ color: 'var(--charcoal-light)' }}
                >
                  Every connection is scoped, audited, and traceable to its own ICP principal.
                </p>
              </div>

              <div className="grid lg:grid-cols-2 gap-8 max-w-5xl mx-auto">
                {/* Delegated Identity */}
                <Card className="feature-card bg-white/80 backdrop-blur-sm rounded-2xl border-0">
                  <CardContent className="p-8">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center mb-6 shadow-lg shadow-teal-500/20">
                      <Lock className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-xl font-semibold mb-4" style={{ color: 'var(--charcoal)' }}>
                      Per-connection Identity
                    </h3>
                    <p className="text-base mb-4" style={{ color: 'var(--charcoal-light)' }}>
                      Each connection signs canister calls as its own ICP principal, derived on the gateway
                      from a secret seed. Nothing is stored per connection, and every call is attributed to
                      that connection rather than a shared key.
                    </p>
                    <ul className="space-y-2">
                      {[
                        'OAuth 2.1 with PKCE; access tokens last 60 minutes',
                        'Approved with the user\'s email and a one-time code',
                        'A revoked grant stops working on the next call',
                        'Canister-level access control on every transaction',
                      ].map((item) => (
                        <li key={item} className="flex items-start gap-2 text-sm" style={{ color: 'var(--charcoal-light)' }}>
                          <ChevronRight className="w-4 h-4 text-teal-600 mt-0.5 flex-shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>

                {/* Rate Limits & Audit */}
                <Card className="feature-card bg-white/80 backdrop-blur-sm rounded-2xl border-0">
                  <CardContent className="p-8">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center mb-6 shadow-lg shadow-teal-500/20">
                      <Activity className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-xl font-semibold mb-4" style={{ color: 'var(--charcoal)' }}>
                      Rate Limits & Audit Logging
                    </h3>
                    <p className="text-base mb-4" style={{ color: 'var(--charcoal-light)' }}>
                      Consequential actions are recorded in the on-chain audit log under the connection's
                      principal, and the canisters rate-limit every caller.
                    </p>
                    <ul className="space-y-2">
                      {[
                        '20 write calls a minute per principal, enforced on-chain',
                        'Sign-in and token endpoints rate-limited per IP',
                        'Agent grants recorded on-chain with the approving client',
                        'Full audit trail stored on-chain',
                      ].map((item) => (
                        <li key={item} className="flex items-start gap-2 text-sm" style={{ color: 'var(--charcoal-light)' }}>
                          <ChevronRight className="w-4 h-4 text-teal-600 mt-0.5 flex-shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </div>

              {/* RBAC Roles Table */}
              <div className="max-w-4xl mx-auto mt-12">
                <h3 className="text-xl font-semibold mb-6 text-center" style={{ color: 'var(--charcoal)' }}>
                  Bot RBAC Roles
                </h3>
                <Card className="feature-card bg-white/80 backdrop-blur-sm rounded-2xl border-0 overflow-hidden">
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr style={{ background: 'var(--warm-stone)' }}>
                            <th className="text-left px-6 py-4 text-sm font-semibold" style={{ color: 'var(--charcoal)' }}>Role</th>
                            <th className="text-left px-6 py-4 text-sm font-semibold" style={{ color: 'var(--charcoal)' }}>Scope</th>
                            <th className="text-left px-6 py-4 text-sm font-semibold" style={{ color: 'var(--charcoal)' }}>Description</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y" style={{ borderColor: 'rgba(0,0,0,0.04)' }}>
                          {rbacRoles.map((r) => (
                            <tr key={r.role} className="tool-row">
                              <td className="px-6 py-4">
                                <code className="text-sm font-mono font-medium text-teal-700 bg-teal-50 px-2.5 py-1 rounded-md">
                                  {r.role}
                                </code>
                              </td>
                              <td className="px-6 py-4 text-sm font-medium" style={{ color: 'var(--charcoal)' }}>
                                {r.scope}
                              </td>
                              <td className="px-6 py-4 text-sm" style={{ color: 'var(--charcoal-light)' }}>
                                {r.description}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </section>

          {/* Quick Links */}
          <section className="py-20 sm:py-28" style={{ background: 'var(--warm-stone)' }}>
            <div className="container px-4 sm:px-6">
              <div className="text-center mb-16">
                <h2
                  className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold mb-6"
                  style={{ color: 'var(--charcoal)' }}
                >
                  Quick Links
                </h2>
                <p
                  className="font-serif text-lg sm:text-xl max-w-2xl mx-auto"
                  style={{ color: 'var(--charcoal-light)' }}
                >
                  Everything you need to get your bot up and running.
                </p>
              </div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
                {quickLinks.map((link) => {
                  const Icon = link.icon;
                  const isExternal = link.href.startsWith('http');
                  return (
                    <button
                      key={link.title}
                      onClick={() => {
                        if (isExternal) {
                          window.open(link.href, '_blank');
                        } else {
                          window.open(link.href, '_blank');
                        }
                      }}
                      className="feature-card bg-white rounded-2xl p-6 text-left group"
                    >
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center text-teal-600 flex-shrink-0">
                          <Icon className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-base" style={{ color: 'var(--charcoal)' }}>
                              {link.title}
                            </h3>
                            {isExternal && <ExternalLink className="w-3.5 h-3.5 text-teal-500" />}
                          </div>
                          <p className="text-sm" style={{ color: 'var(--charcoal-light)' }}>
                            {link.description}
                          </p>
                        </div>
                        <ArrowRight className="w-4 h-4 text-teal-500 mt-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          {/* CTA Section */}
          <section className="cta-gradient py-20 sm:py-28 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-96 h-96 bg-white/5 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
            <div className="absolute bottom-0 right-0 w-80 h-80 bg-white/5 rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />

            <div className="container relative z-10 text-center px-4 sm:px-6">
              <div className="w-20 h-20 mx-auto mb-8 rounded-3xl bg-white/10 backdrop-blur flex items-center justify-center">
                <Bot className="w-10 h-10 text-white" />
              </div>

              <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-6">
                Ready to Build?
              </h2>

              <p className="text-lg sm:text-xl text-white/90 mb-10 max-w-2xl mx-auto">
                Add the PropXchain connector, approve it with your email, and make your first tool call in minutes.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button
                  size="lg"
                  onClick={() => navigate('/dashboard/bot-agents')}
                  className="bg-white text-teal-700 hover:bg-gray-100 text-lg px-10 py-6 shadow-2xl"
                >
                  Manage Bot Access
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => window.open('/auth.md', '_blank')}
                  className="text-lg px-10 py-6 border-2 border-white/30 text-white hover:bg-white/10"
                >
                  <ExternalLink className="mr-2 h-5 w-5" />
                  Connection Guide
                </Button>
              </div>
            </div>
          </section>
        </main>

        {/* Footer */}
        <footer className="py-16 border-t" style={{ background: 'var(--warm-cream)', borderColor: 'rgba(0,0,0,0.05)' }}>
          <div className="container px-4 sm:px-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 sm:gap-12">
              <div className="col-span-2 md:col-span-1">
                <div className="flex items-center gap-3 mb-4">
                  <Logo variant="mark" tone="onLight" to={null} className="h-11 w-auto" />
                </div>
                <p className="text-sm sm:text-base" style={{ color: 'var(--charcoal-light)' }}>
                  AI-powered property conveyancing on the Internet Computer blockchain.
                </p>
              </div>

              <div>
                <h4 className="font-semibold mb-3 sm:mb-4 text-sm sm:text-base" style={{ color: 'var(--charcoal)' }}>Product</h4>
                <ul className="space-y-2 sm:space-y-3">
                  {['Features', 'How It Works', 'About Us', 'Developers'].map((item) => (
                    <li key={item}>
                      <button
                        className="text-sm transition-colors hover:text-teal-600"
                        style={{ color: 'var(--charcoal-light)' }}
                        onClick={() => navigate(`/${item.toLowerCase().replace(/\s+/g, '-')}`)}
                      >
                        {item}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h4 className="font-semibold mb-3 sm:mb-4 text-sm sm:text-base" style={{ color: 'var(--charcoal)' }}>Legal</h4>
                <ul className="space-y-2 sm:space-y-3">
                  {['Terms of Service', 'Privacy Policy', 'Compliance'].map((item) => (
                    <li key={item}>
                      <button
                        className="text-sm transition-colors hover:text-teal-600"
                        style={{ color: 'var(--charcoal-light)' }}
                        onClick={() => navigate(`/${item.toLowerCase().replace(/\s+/g, '-')}`)}
                      >
                        {item}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h4 className="font-semibold mb-3 sm:mb-4 text-sm sm:text-base" style={{ color: 'var(--charcoal)' }}>Contact</h4>
                <ul className="space-y-2 sm:space-y-3">
                  {['Support', 'Sales', 'Partners'].map((item) => (
                    <li key={item}>
                      <button
                        className="text-sm transition-colors hover:text-teal-600"
                        style={{ color: 'var(--charcoal-light)' }}
                        onClick={() => navigate(`/${item.toLowerCase()}`)}
                      >
                        {item}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="mt-12 pt-8 border-t text-center" style={{ borderColor: 'rgba(0,0,0,0.05)' }}>
              <p className="text-xs sm:text-sm" style={{ color: 'var(--charcoal-light)' }}>
                &copy; 2025 PropXchain. All rights reserved. Marc Hatton
              </p>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
};

export default ApiDocsPage;
