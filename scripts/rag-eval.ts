/**
 * RAG evaluation harness for Phase 4's Knowledge Base.
 * Run with: npm run rag-eval
 *
 * Ingests a handful of realistic seed documents through the *real* pipeline
 * (uploadDocument -> processDocument: extraction, chunking, real Gemini
 * embeddings, vector storage), then runs a small Q&A dataset against the
 * standalone `rag-service.answer()` and reports retrieval correctness,
 * answer correctness, no-answer behavior, and citation correctness.
 */
import { connectToDatabase } from "../src/lib/db/connect";
import { User } from "../src/models/User";
import { Organization } from "../src/models/Organization";
import { Membership } from "../src/models/Membership";
import { Document } from "../src/models/Document";
import { DocumentChunk } from "../src/models/DocumentChunk";
import { hashPassword } from "../src/lib/auth/password";
import { uploadDocument, processDocument } from "../src/services/document.service";
import { answer } from "../src/ai/rag/rag-service";
import { searchKnowledgeBase } from "../src/ai/rag/retrieval-service";
import type { SessionPayload } from "../src/lib/auth/session";

/**
 * --retrieval-only skips the chat-generation step (generateText) and checks
 * only retrieval + citations via searchKnowledgeBase directly. Useful when
 * the Gemini free tier's daily chat-generation quota (as low as 20
 * requests/day) is already exhausted for the day but the separate
 * embedding quota is not — retrieval quality can still be evaluated.
 */
const RETRIEVAL_ONLY = process.argv.includes("--retrieval-only");

const EVAL_EMAIL = "rag-eval@bizai.dev";
const EVAL_ORG_SLUG = "bizai-rag-eval";
const EVAL_ORG_NAME = "BizAI RAG Eval Co";

async function ensureEvalOrganization(): Promise<SessionPayload> {
  let user = await User.findOne({ email: EVAL_EMAIL });
  if (!user) {
    const passwordHash = await hashPassword("Eval@1234");
    user = await User.create({ name: "RAG Eval Owner", email: EVAL_EMAIL, passwordHash });
  }

  let organization = await Organization.findOne({ slug: EVAL_ORG_SLUG });
  if (!organization) {
    organization = await Organization.create({ name: EVAL_ORG_NAME, slug: EVAL_ORG_SLUG, ownerId: user._id });
  }

  user.activeOrganizationId = organization._id;
  await user.save();
  await Membership.findOneAndUpdate(
    { userId: user._id, organizationId: organization._id },
    { $setOnInsert: { role: "owner" } },
    { upsert: true },
  );

  return { userId: user._id.toString(), organizationId: organization._id.toString(), role: "owner" };
}

async function wipeEvalKnowledgeBase(organizationId: string): Promise<void> {
  const docs = await Document.find({ organizationId }).select("_id");
  await DocumentChunk.deleteMany({ organizationId });
  await Document.deleteMany({ organizationId });
  void docs; // storage files are left behind under .data/uploads for this dedicated eval org; harmless.
}

const SEED_DOCUMENTS: { fileName: string; content: string }[] = [
  {
    fileName: "Warranty Policy.txt",
    content: `Warranty Policy

Standard Warranty
All products purchased from BizAI Demo Co are covered by a standard warranty of 12 months from the date of purchase. The warranty covers manufacturing defects in materials and workmanship under normal use.

What Is Not Covered
The warranty does not cover physical damage, water damage, damage caused by unauthorized repair or modification, or normal wear and tear. Products that have been used outside their intended purpose are also excluded.

Extended Warranty
Customers may purchase an extended warranty for an additional 12 months at checkout for a flat fee of $49. The extended warranty covers the same terms as the standard warranty.

How to Claim a Warranty Repair
To claim a warranty repair, contact customer support within 30 days of discovering the issue and provide proof of purchase. Support will issue a return authorization and provide instructions.

Transferability
The warranty is non-transferable. It applies only to the original purchaser and cannot be transferred to a subsequent owner if the product is resold.`,
  },
  {
    fileName: "Installation Manual.txt",
    content: `Installation Manual

Unboxing and Parts List
When you unbox the product, check that the box contains: the main unit, a power adapter, a mounting bracket, four mounting screws, and a quick start guide. Contact support if any part is missing.

Tools Required
You will need a Phillips screwdriver to install the mounting bracket. A drill is recommended if mounting into a masonry wall.

Mounting Instructions
Attach the mounting bracket to the wall using the provided screws, ensuring it is level. Slide the main unit onto the bracket until it clicks into place. Connect the power adapter to the unit and then to a wall outlet.

Power Safety Warning
Do not connect the unit to a power source above 240V. Doing so may damage the unit and will void the warranty.

Wi-Fi Setup
Press and hold the setup button for 3 seconds until the status light flashes blue, then follow the instructions in the companion app to join your Wi-Fi network.

Troubleshooting: Red Blinking Light
A red blinking light indicates the unit requires a firmware update. Connect the unit to the internet and it will update automatically within a few minutes.

Factory Reset
To reset the unit to factory settings, hold the reset button for 10 seconds until the status light turns off and back on.`,
  },
  {
    fileName: "Company Policy.txt",
    content: `Company Policy Handbook

Remote Work Policy
Employees in eligible roles may work remotely up to 3 days per week, subject to manager approval. Roles requiring on-site equipment access are not eligible for remote work.

Leave Policy
Full-time employees receive 18 days of annual leave and 10 days of sick leave per calendar year. Unused annual leave may be carried over up to 5 days into the next year.

Working Hours
Standard working hours are 9:00 AM to 6:00 PM. The company observes flexible core hours between 11:00 AM and 4:00 PM, during which all employees must be available.

Expense Reimbursement
Employees must submit expense reimbursement requests within 30 days of the expense, along with itemized receipts. Reimbursements without receipts will not be processed.

Data Confidentiality
Employees must not share confidential company data, including customer records and financial information, with anyone outside the company without written authorization.`,
  },
];

interface EvalCase {
  question: string;
  expectedDocument: string | null; // substring to look for in a cited source's document name; null = expect noAnswer
  expectedKeywords: string[]; // case-insensitive substrings expected somewhere in the answer text
}

const EVAL_DATASET: EvalCase[] = [
  { question: "How long is the standard warranty period?", expectedDocument: "Warranty", expectedKeywords: ["12 month"] },
  { question: "What does the warranty not cover?", expectedDocument: "Warranty", expectedKeywords: ["water damage"] },
  { question: "How do I claim a warranty repair?", expectedDocument: "Warranty", expectedKeywords: ["30 days"] },
  {
    question: "Can I transfer my product's warranty to someone else if I sell it?",
    expectedDocument: "Warranty",
    expectedKeywords: ["non-transferable"],
  },
  {
    question: "Does the warranty cover accidental water damage to my device?",
    expectedDocument: "Warranty",
    expectedKeywords: ["water damage"],
  },
  {
    question: "What tools do I need to install the device on my wall?",
    expectedDocument: "Installation",
    expectedKeywords: ["phillips"],
  },
  {
    question: "What does a red blinking light mean on the device?",
    expectedDocument: "Installation",
    expectedKeywords: ["firmware"],
  },
  {
    question: "How do I reset the device to factory settings?",
    expectedDocument: "Installation",
    expectedKeywords: ["10 seconds"],
  },
  {
    question: "What parts are included when I unbox the product?",
    expectedDocument: "Installation",
    expectedKeywords: ["mounting bracket"],
  },
  {
    question: "How many days per week can employees work remotely?",
    expectedDocument: "Company",
    expectedKeywords: ["3 days"],
  },
  {
    question: "How many annual leave days do full-time employees get?",
    expectedDocument: "Company",
    expectedKeywords: ["18 days"],
  },
  {
    question: "What are the company's core working hours?",
    expectedDocument: "Company",
    expectedKeywords: ["11:00", "4:00"],
  },
  {
    question: "How long do employees have to submit an expense reimbursement?",
    expectedDocument: "Company",
    expectedKeywords: ["30 days"],
  },
  { question: "What is the capital of France?", expectedDocument: null, expectedKeywords: [] },
  { question: "What was our company's revenue last quarter?", expectedDocument: null, expectedKeywords: [] },
];

interface CaseResult {
  question: string;
  expectedDocument: string | null;
  retrievalCorrect: boolean;
  answerCorrect: boolean;
  noAnswerCorrect: boolean;
  citationCorrect: boolean;
  actualAnswer: string;
  actualSources: string[];
}

function checkKeywords(text: string, keywords: string[]): boolean {
  if (keywords.length === 0) return true;
  const lower = text.toLowerCase();
  return keywords.some((k) => lower.includes(k.toLowerCase()));
}

async function main() {
  await connectToDatabase();
  const session = await ensureEvalOrganization();
  await wipeEvalKnowledgeBase(session.organizationId);

  console.log(`\nIngesting ${SEED_DOCUMENTS.length} seed documents through the real pipeline...`);
  for (const doc of SEED_DOCUMENTS) {
    const existing = await Document.findOne({ organizationId: session.organizationId, originalName: doc.fileName });
    if (existing?.status === "READY") {
      console.log(`  already READY: ${doc.fileName} (${existing.chunkCount} chunks) — skipping re-ingestion`);
      continue;
    }
    const summary = await uploadDocument(session, {
      fileName: doc.fileName,
      mimeType: "text/plain",
      buffer: Buffer.from(doc.content, "utf-8"),
    });
    await processDocument(summary.id);
    const processed = await Document.findById(summary.id);
    if (processed?.status !== "READY") {
      throw new Error(`Document "${doc.fileName}" failed to process: ${processed?.processingError}`);
    }
    console.log(`  READY: ${doc.fileName} (${processed.chunkCount} chunks, ${processed.pageCount ?? "n/a"} pages)`);
  }

  console.log(`\nRunning ${EVAL_DATASET.length} evaluation questions...\n`);
  const results: CaseResult[] = [];

  async function answerWithRetry(question: string, attempts = 3): Promise<Awaited<ReturnType<typeof answer>>> {
    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        return await answer(session.organizationId, question);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (attempt === attempts || !message.includes("429")) throw error;
        console.log(`       (rate-limited, waiting 30s before retry ${attempt + 1}/${attempts})`);
        await new Promise((resolve) => setTimeout(resolve, 30000));
      }
    }
    throw new Error("unreachable");
  }

  if (RETRIEVAL_ONLY) {
    console.log("(--retrieval-only: skipping chat generation, checking retrieval + citations only)\n");
  }

  for (const [index, evalCase] of EVAL_DATASET.entries()) {
    // The free-tier Gemini quota for the chat model can be as low as a
    // handful of requests per minute (and per day); space out
    // generateText calls so the eval doesn't 429.
    if (!RETRIEVAL_ONLY && index > 0) await new Promise((resolve) => setTimeout(resolve, 20000));

    let sources: { documentName: string; pageNumber: number | null }[];
    let noAnswer: boolean;
    let answerText: string;

    if (RETRIEVAL_ONLY) {
      const chunks = await searchKnowledgeBase({ organizationId: session.organizationId, query: evalCase.question });
      sources = chunks.map((c) => ({ documentName: c.documentName, pageNumber: c.pageNumber }));
      noAnswer = chunks.length === 0;
      answerText = "(skipped — --retrieval-only)";
    } else {
      const result = await answerWithRetry(evalCase.question);
      sources = result.sources;
      noAnswer = result.noAnswer;
      answerText = result.answer;
    }

    const retrievalCorrect =
      evalCase.expectedDocument === null
        ? sources.length === 0 || noAnswer
        : sources.some((s) => s.documentName.includes(evalCase.expectedDocument!));

    const noAnswerCorrect = evalCase.expectedDocument === null ? noAnswer : !noAnswer;

    const answerCorrect = RETRIEVAL_ONLY
      ? true // not evaluated in this mode
      : evalCase.expectedDocument === null
        ? noAnswer
        : checkKeywords(answerText, evalCase.expectedKeywords);

    const citationCorrect =
      evalCase.expectedDocument === null
        ? true
        : sources.length > 0 && sources.every((s) => s.documentName.trim().length > 0);

    results.push({
      question: evalCase.question,
      expectedDocument: evalCase.expectedDocument,
      retrievalCorrect,
      answerCorrect,
      noAnswerCorrect,
      citationCorrect,
      actualAnswer: answerText,
      actualSources: sources.map((s) => `${s.documentName}${s.pageNumber ? ` p.${s.pageNumber}` : ""}`),
    });

    const status = retrievalCorrect && answerCorrect && noAnswerCorrect && citationCorrect ? "PASS" : "FAIL";
    console.log(`[${status}] ${evalCase.question}`);
    if (status === "FAIL") {
      console.log(`       expected doc: ${evalCase.expectedDocument ?? "(none — no-answer expected)"}`);
      console.log(`       got sources : ${sources.map((s) => s.documentName).join(", ") || "(none)"}`);
      console.log(`       answer      : ${answerText.slice(0, 200)}`);
    }
  }

  const total = results.length;
  const summary = {
    total,
    retrievalCorrect: results.filter((r) => r.retrievalCorrect).length,
    answerCorrect: results.filter((r) => r.answerCorrect).length,
    noAnswerCorrect: results.filter((r) => r.noAnswerCorrect).length,
    citationCorrect: results.filter((r) => r.citationCorrect).length,
    overallPass: results.filter(
      (r) => r.retrievalCorrect && r.answerCorrect && r.noAnswerCorrect && r.citationCorrect,
    ).length,
  };

  console.log("\n=== RAG Evaluation Summary ===");
  console.log(`Total questions:      ${summary.total}`);
  console.log(`Retrieval correct:    ${summary.retrievalCorrect}/${total}`);
  console.log(`Answer correct:       ${RETRIEVAL_ONLY ? "N/A (--retrieval-only)" : `${summary.answerCorrect}/${total}`}`);
  console.log(`No-answer correct:    ${summary.noAnswerCorrect}/${total}`);
  console.log(`Citation correct:     ${summary.citationCorrect}/${total}`);
  console.log(`Overall pass:         ${RETRIEVAL_ONLY ? "N/A (--retrieval-only)" : `${summary.overallPass}/${total}`}`);

  process.exit(summary.overallPass === total ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
