// Sample cybersecurity quizzes, seeded automatically for a host the first time
// they sign in with an empty dashboard (see ensureSampleQuizzes). This replaces
// the old hardcoded-email seed.sql so the repo is a clean, public template:
// quizzes are owned by whoever deploys/signs in, with nothing to edit.

import { nanoid } from 'nanoid';
import type { Env } from './env';
import type { QuestionType } from './types';

interface SampleOption {
  text: string;
  isCorrect: boolean;
}
interface SampleQuestion {
  type: QuestionType;
  text: string;
  timeLimitS: number;
  points: number;
  options: SampleOption[];
}
interface SampleQuiz {
  title: string;
  description: string;
  questions: SampleQuestion[];
}

const mc = (
  text: string,
  timeLimitS: number,
  options: SampleOption[],
): SampleQuestion => ({ type: 'multiple_choice', text, timeLimitS, points: 1000, options });

const tf = (text: string, answer: boolean, timeLimitS = 15): SampleQuestion => ({
  type: 'true_false',
  text,
  timeLimitS,
  points: 1000,
  options: [
    { text: 'True', isCorrect: answer },
    { text: 'False', isCorrect: !answer },
  ],
});

const o = (text: string, isCorrect = false): SampleOption => ({ text, isCorrect });

export const SAMPLE_QUIZZES: SampleQuiz[] = [
  {
    title: 'Cybersecurity Fundamentals',
    description:
      'Core concepts every team member should know: the CIA triad, MFA, least privilege, and common malware.',
    questions: [
      mc('What does the "CIA triad" stand for in information security?', 20, [
        o('Confidentiality, Integrity, Availability', true),
        o('Control, Inspection, Authorization'),
        o('Cryptography, Identity, Access'),
        o('Confidentiality, Identity, Auditing'),
      ]),
      tf(
        'Multi-factor authentication (MFA) combines two or more different types of authentication factors.',
        true,
      ),
      mc('Which is the strongest everyday password practice?', 20, [
        o('Use a long, unique passphrase per site with a password manager', true),
        o('Reuse one complex password everywhere'),
        o('Use a short password you can type fast'),
        o('Keep passwords on a sticky note on your monitor'),
      ]),
      mc('The principle of "least privilege" means:', 20, [
        o('Give users only the access they need to do their job', true),
        o('Give every employee administrator rights'),
        o('Give all users read access to every system'),
        o('Remove all access from everyone by default'),
      ]),
      mc('Which type of malware encrypts your files and demands payment to restore them?', 20, [
        o('Ransomware', true),
        o('Adware'),
        o('Rootkit'),
        o('Keylogger'),
      ]),
    ],
  },
  {
    title: 'Phishing & Social Engineering',
    description:
      'Spotting the human side of attacks: phishing, pretexting, vishing, and tailgating.',
    questions: [
      mc('Phishing attacks primarily target which part of a system?', 20, [
        o('People, by tricking them into revealing information or credentials', true),
        o('Firewalls, by overloading their rules'),
        o('Encryption keys, by factoring them'),
        o('DNS servers, by poisoning their cache'),
      ]),
      tf('Spear-phishing is tailored to a specific individual or organization.', true),
      mc('A caller pretends to be IT support and asks for your password. This technique is:', 20, [
        o('Pretexting / vishing (voice phishing)', true),
        o('A DDoS attack'),
        o('SQL injection'),
        o('A buffer overflow'),
      ]),
      mc('An unexpected email urges you to click a link to "verify your account". Best first action:', 20, [
        o('Do not click; report the email to security or IT', true),
        o('Click the link to check whether it is safe'),
        o('Forward it to coworkers to warn them'),
        o('Reply and ask the sender if it is legitimate'),
      ]),
      mc('In physical security, "tailgating" means:', 20, [
        o('Following an authorized person through a secure door', true),
        o('Sending bulk unsolicited email'),
        o('Guessing passwords repeatedly'),
        o('Intercepting traffic on open Wi-Fi'),
      ]),
    ],
  },
  {
    title: 'Web App Security: OWASP Top 10',
    description:
      'Advanced: SQL injection, XSS, CSRF, and broken access control with their mitigations.',
    questions: [
      mc('The most reliable defense against SQL injection is:', 25, [
        o('Parameterized queries / prepared statements', true),
        o('Hiding the database port number'),
        o('Writing longer SQL statements'),
        o('Disabling browser cookies'),
      ]),
      mc('Cross-Site Scripting (XSS) lets an attacker:', 25, [
        o('Run malicious scripts in the browser of another user', true),
        o('Read the server hard disk directly'),
        o('Crack stored password hashes instantly'),
        o('Spoof a network MAC address'),
      ]),
      mc('Cross-Site Request Forgery (CSRF) is commonly mitigated with:', 25, [
        o('Anti-CSRF tokens and SameSite cookies', true),
        o('Longer session timeouts'),
        o('Base64 encoding the request body'),
        o('Turning off HTTPS'),
      ]),
      tf('Properly encoding or escaping output helps prevent XSS.', true),
      mc('"Broken Access Control" (OWASP #1) describes when:', 25, [
        o('Users can act outside their intended permissions', true),
        o('A TLS certificate has expired'),
        o('Application logs are too verbose'),
        o('Passwords are stored as salted hashes'),
      ]),
    ],
  },
  {
    title: 'Network Security Essentials',
    description: 'Advanced: TLS, firewalls, common ports, VPNs, and man-in-the-middle attacks.',
    questions: [
      mc('HTTPS secures web traffic using which protocol?', 20, [
        o('TLS (Transport Layer Security)', true),
        o('Telnet'),
        o('FTP'),
        o('SNMP'),
      ]),
      mc('The main job of a firewall is to:', 20, [
        o('Filter and control network traffic based on rules', true),
        o('Encrypt every file stored on disk'),
        o('Store user passwords securely'),
        o('Replace antivirus entirely'),
      ]),
      mc('Which TCP port does HTTPS use by default?', 20, [
        o('443', true),
        o('80'),
        o('22'),
        o('25'),
      ]),
      mc('A VPN primarily provides:', 20, [
        o('An encrypted tunnel for traffic over untrusted networks', true),
        o('Guaranteed faster internet speeds'),
        o('Free public Wi-Fi access'),
        o('Built-in antivirus scanning'),
      ]),
      tf('A man-in-the-middle attack secretly intercepts communication between two parties.', true),
    ],
  },
  {
    title: 'Cryptography Essentials',
    description:
      'Advanced: symmetric vs asymmetric encryption, hashing, safe password storage, and how TLS works.',
    questions: [
      mc('Symmetric encryption is characterized by:', 20, [
        o('The same key is used to encrypt and decrypt', true),
        o('A separate public and private key pair is used'),
        o('No key is required at all'),
        o('Only one-way hashing is performed'),
      ]),
      mc('Which of these is an asymmetric (public-key) algorithm?', 20, [
        o('RSA', true),
        o('AES'),
        o('SHA-256'),
        o('ChaCha20'),
      ]),
      mc('A cryptographic hash function such as SHA-256 is:', 25, [
        o('A one-way function producing a fixed-size digest', true),
        o('Reversible if you have the correct key'),
        o('A symmetric cipher for bulk data'),
        o('A lossless compression algorithm'),
      ]),
      mc('The recommended way to store user passwords is to:', 25, [
        o('Salt and hash them with a slow algorithm like bcrypt or argon2', true),
        o('Encrypt them with AES and email the key to admins'),
        o('Store them in plaintext for easy support resets'),
        o('Base64-encode them before saving'),
      ]),
      tf('TLS uses asymmetric cryptography to securely exchange a symmetric session key.', true),
    ],
  },
  {
    title: 'Malware & Incident Response',
    description:
      'Advanced: the IR lifecycle, zero-days, indicators of compromise, rootkits, and containment.',
    questions: [
      mc('Which ordering reflects a typical incident response lifecycle?', 25, [
        o('Preparation, Detection, Containment, Eradication, Recovery', true),
        o('Recovery, Detection, Preparation, Containment, Eradication'),
        o('Containment, Recovery, Detection, Preparation, Eradication'),
        o('Detection, Recovery, Preparation, Eradication, Containment'),
      ]),
      mc('A "zero-day" vulnerability is one that:', 25, [
        o('Has no available patch and is unknown to the vendor', true),
        o('Was fixed by the vendor years ago'),
        o('Is simply a weak password policy'),
        o('Is a brand of firewall'),
      ]),
      mc('An Indicator of Compromise (IOC) is:', 20, [
        o('Evidence suggesting a system may have been breached', true),
        o('A compliance certificate for auditors'),
        o('An encryption standard like AES'),
        o('A category of network cable'),
      ]),
      mc('A rootkit is especially dangerous because it:', 25, [
        o('Hides its presence while maintaining privileged access', true),
        o('Only displays unwanted advertisements'),
        o('Speeds up the CPU for gaming'),
        o('Automatically backs up your files'),
      ]),
      tf('Isolating an infected host from the network is part of the containment phase.', true),
    ],
  },
];

/**
 * Seed the sample quizzes for a host the first time they have an empty
 * dashboard. Idempotent: skipped if they already own any quiz (so it never
 * duplicates and never overwrites). Migration-independent and fails open — it
 * must never block the request.
 */
export async function ensureSampleQuizzes(env: Env, ownerId: string): Promise<void> {
  if (env.SEED_SAMPLE_QUIZZES === 'false') return;
  try {
    const existing = await env.DB.prepare(`SELECT COUNT(*) AS c FROM quizzes WHERE owner_id = ?`)
      .bind(ownerId)
      .first<{ c: number }>();
    if (existing && existing.c > 0) return;

    const statements: D1PreparedStatement[] = [];
    const now = Date.now();
    for (const quiz of SAMPLE_QUIZZES) {
      const quizId = nanoid();
      statements.push(
        env.DB.prepare(
          `INSERT INTO quizzes (id, owner_id, title, description, is_archived, created_at, updated_at)
           VALUES (?, ?, ?, ?, 0, ?, ?)`,
        ).bind(quizId, ownerId, quiz.title, quiz.description, now, now),
      );
      quiz.questions.forEach((q, qi) => {
        const qid = nanoid();
        statements.push(
          env.DB.prepare(
            `INSERT INTO questions (id, quiz_id, position, type, text, time_limit_s, points)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
          ).bind(qid, quizId, qi, q.type, q.text, q.timeLimitS, q.points),
        );
        q.options.forEach((opt, oi) => {
          statements.push(
            env.DB.prepare(
              `INSERT INTO answer_options (id, question_id, position, text, is_correct)
               VALUES (?, ?, ?, ?, ?)`,
            ).bind(nanoid(), qid, oi, opt.text, opt.isCorrect ? 1 : 0),
          );
        });
      });
    }
    await env.DB.batch(statements);
  } catch {
    // Never block the request over sample seeding.
  }
}
