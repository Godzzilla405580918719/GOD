import { AutomationTask } from './types';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const defaultTasks: AutomationTask[] = [
  {
    id: 'summarize',
    name: 'Summarize Input',
    command: 'Extract key points and action items.',
    enabled: true
  },
  {
    id: 'roadmap',
    name: 'Generate Roadmap',
    command: 'Create a short execution plan.',
    enabled: true
  },
  {
    id: 'safety-check',
    name: 'Safety Check',
    command: 'Block requests for privilege escalation or system exploitation.',
    enabled: true
  },
  {
    id: 'answer-web-questions',
    name: 'Answer Web Questions',
    command: 'Extract and answer questions from the current webpage content.',
    enabled: true
  },
  {
    id: 'extract-links',
    name: 'Extract Links',
    command: 'Pull all hyperlinks and URLs from the provided content.',
    enabled: true
  },
  {
    id: 'faq-generator',
    name: 'FAQ Generator',
    command: 'Create a frequently asked questions list from the content.',
    enabled: true
  },
  {
    id: 'code-extractor',
    name: 'Code Extractor',
    command: 'Extract code snippets and provide explanations.',
    enabled: true
  },
  {
    id: 'key-phrases',
    name: 'Key Phrases',
    command: 'Extract and list important keywords and topics.',
    enabled: true
  }
];

export async function runAutomation(userPrompt: string, tasks: AutomationTask[]): Promise<string[]> {
  const activeTasks = tasks.filter((task) => task.enabled);

  if (!activeTasks.length) {
    return ['No automation tasks enabled.'];
  }

  const outputs: string[] = [];
  const cleanedPrompt = userPrompt.trim();

  for (const task of activeTasks) {
    await wait(120);
    
    switch (task.id) {
      case 'summarize': {
        outputs.push(`[${task.name}]\n${cleanedPrompt.length > 300 ? cleanedPrompt.slice(0, 300) + '...' : cleanedPrompt}`);
        break;
      }

      case 'roadmap': {
        outputs.push(`[${task.name}]\n1. Understand the problem\n2. Identify key steps\n3. Execute and validate\n4. Document results`);
        break;
      }

      case 'safety-check': {
        const blocked = ['admin rights', 'privilege escalation', 'reverse engineer'];
        const matched = blocked.filter((word) => cleanedPrompt.toLowerCase().includes(word));
        const isSafe = matched.length === 0;
        outputs.push(
          `[${task.name}]\n${
            isSafe ? '✅ Safe to execute' : `⚠️ Needs manual review (matched: ${matched.join(', ')})`
          }`
        );
        break;
      }

      case 'answer-web-questions': {
        const urlPattern = cleanedPrompt.match(/https?:\/\/[^\s]+/);
        const questionMatches =
          cleanedPrompt.match(/[^?\n][^?]*\?/g)?.map((question) => question.trim()).filter(Boolean) ?? [];
        const correctAnswerMatch = cleanedPrompt.match(
          /(?:correct(?:\s+answer)?|answer)\s*[:\-]\s*([^\n]+)/i
        );
        if (urlPattern) {
          const questionPreview =
            questionMatches.length > 0 ? `\nDetected question(s):\n${questionMatches.map((q) => `- ${q}`).join('\n')}` : '';
          outputs.push(
            `[${task.name}]\n📄 Webpage detected: ${urlPattern[0]}${questionPreview}\nUse the Paste Page Text box for exact grounded answers, or let GOD try to fetch page content automatically.`
          );
        } else {
          if (questionMatches.length > 0) {
            const extractedAnswer = correctAnswerMatch?.[1]?.trim();
            outputs.push(
              `[${task.name}]\nDetected ${questionMatches.length} question(s).\n❔ Questions:\n${questionMatches.map((q) => `- ${q}`).join('\n')}${
                extractedAnswer ? `\n✅ Possible answer found in provided content: ${extractedAnswer}` : ''
              }${
                extractedAnswer
                  ? ''
                  : '\nℹ️ No explicit "correct answer" text found. Paste more of the page content or metadata.'
              }`
            );
          } else {
            outputs.push(`[${task.name}]\nNo questions detected in input.`);
          }
        }
        break;
      }

      case 'extract-links': {
        const urlMatch = cleanedPrompt.match(/https?:\/\/[^\s]+/g) || [];
        if (urlMatch.length > 0) {
          outputs.push(`[${task.name}]\nFound ${urlMatch.length} link(s):\n${urlMatch.map((url) => `- ${url}`).join('\n')}`);
        } else {
          outputs.push(`[${task.name}]\nNo links found in input.`);
        }
        break;
      }

      case 'faq-generator': {
        outputs.push(`[${task.name}]\nFAQ structure would extract Q&A patterns from content. Manual extraction recommended for accuracy.`);
        break;
      }

      case 'code-extractor': {
        const codeMatch = cleanedPrompt.match(/```[\s\S]*?```/g) || [];
        if (codeMatch.length > 0) {
          outputs.push(`[${task.name}]\nFound ${codeMatch.length} code block(s).`);
        } else {
          outputs.push(`[${task.name}]\nNo code blocks detected.`);
        }
        break;
      }

      case 'key-phrases': {
        const words = cleanedPrompt.split(/\s+/).filter((w) => w.length > 5);
        const unique = [...new Set(words)].slice(0, 5);
        outputs.push(`[${task.name}]\nKey terms: ${unique.join(', ')}`);
        break;
      }

      default: {
        outputs.push(`[${task.name}] ${task.command}`);
        break;
      }
    }
  }

  if (cleanedPrompt) {
    outputs.push(`\nInput: "${cleanedPrompt.slice(0, 200)}${cleanedPrompt.length > 200 ? '...' : ''}"`);
  }

  return outputs;
}
