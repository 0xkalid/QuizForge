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
  {
    title: 'Passwords & Authentication',
    description:
      'MFA, password managers, phishing-resistant keys, SSO, and credential-stuffing.',
    questions: [
      mc('What does multi-factor authentication (MFA) add beyond a password?', 20, [
        o('A second, different factor (something you have or are)', true),
        o('A longer version of the same password'),
        o('A backup copy of your password'),
        o('A faster way to log in'),
      ]),
      mc('A password manager primarily helps you:', 20, [
        o('Generate and store a unique strong password for every site', true),
        o('Memorize one password to reuse everywhere'),
        o('Share passwords openly with your team'),
        o('Disable the need for passwords entirely'),
      ]),
      mc('Which MFA method is the most phishing-resistant?', 20, [
        o('A hardware security key (FIDO2 / WebAuthn)', true),
        o('One-time codes sent over SMS'),
        o('Codes sent by email'),
        o('Security questions'),
      ]),
      mc('Single Sign-On (SSO) lets users:', 20, [
        o('Authenticate once to access multiple applications', true),
        o('Use the same password on unrelated websites'),
        o('Skip authentication entirely'),
        o('Encrypt their hard drive'),
      ]),
      tf('Reusing the same password across sites enables credential-stuffing attacks.', true),
    ],
  },
  {
    title: 'Cloud Security Basics',
    description:
      'Shared responsibility, IAM least privilege, storage misconfiguration, and protecting credentials.',
    questions: [
      mc('In the cloud shared responsibility model, the provider is responsible for:', 25, [
        o('Security OF the cloud (physical infrastructure, hypervisor)', true),
        o('Everything, including your data and configuration'),
        o('Your application code and access controls'),
        o('Nothing — the customer owns all security'),
      ]),
      mc('A very common cause of cloud data breaches is:', 20, [
        o('Storage buckets misconfigured to be publicly accessible', true),
        o('Too much encryption'),
        o('Using multi-factor authentication'),
        o('Rotating credentials too often'),
      ]),
      mc('For your cloud root / top-level admin account you should:', 20, [
        o('Enable MFA and avoid using it for day-to-day work', true),
        o('Share it with the whole team for convenience'),
        o('Disable logging on it'),
        o('Use it for all routine tasks'),
      ]),
      mc('Hard-coding cloud API keys in source code is dangerous because:', 25, [
        o('Anyone with repo access — or a leak — gains your credentials', true),
        o('It makes the code run slower'),
        o('It uses more storage'),
        o('It is required by most frameworks'),
      ]),
      tf('Applying least privilege to IAM roles limits the blast radius if credentials are stolen.', true),
    ],
  },
  {
    title: 'Email Security',
    description: 'SPF/DKIM/DMARC, business email compromise, malicious attachments, and link checks.',
    questions: [
      mc('SPF, DKIM, and DMARC are used to:', 25, [
        o('Authenticate email senders and reduce spoofing', true),
        o('Encrypt the contents of every email'),
        o('Speed up email delivery'),
        o('Compress attachments'),
      ]),
      mc('Business Email Compromise (BEC) typically involves:', 25, [
        o('Impersonating an executive or vendor to request fraudulent payments', true),
        o('Crashing the mail server with traffic'),
        o('Encrypting the mailbox for ransom'),
        o('Guessing the email password by brute force'),
      ]),
      mc('A safe way to handle an unexpected invoice attachment is to:', 20, [
        o('Verify with the sender through a known, separate channel before opening', true),
        o('Open it immediately to see what it is'),
        o('Forward it to colleagues to check'),
        o('Reply asking the sender to confirm in the same thread'),
      ]),
      mc('A link whose hover URL differs from its visible text is:', 20, [
        o('A common sign of a phishing link', true),
        o('Always completely safe'),
        o('A normal part of every email'),
        o('A way to speed up the page'),
      ]),
      tf('DMARC can tell receiving servers to quarantine or reject unauthenticated mail from your domain.', true),
    ],
  },
  {
    title: 'Data Protection & Privacy',
    description: 'Encryption at rest, PII, the 3-2-1 backup rule, data classification, and regulations.',
    questions: [
      mc('"Encryption at rest" protects data that is:', 20, [
        o('Stored on disk or in databases', true),
        o('Moving across the network'),
        o('Only displayed on screen'),
        o('Printed on paper'),
      ]),
      mc('PII stands for:', 15, [
        o('Personally Identifiable Information', true),
        o('Public Internet Index'),
        o('Private Internal Infrastructure'),
        o('Protected Intranet Interface'),
      ]),
      mc('The 3-2-1 backup rule recommends:', 25, [
        o('3 copies of data, on 2 types of media, with 1 kept off-site', true),
        o('3 passwords, 2 admins, 1 server'),
        o('3 firewalls, 2 routers, 1 switch'),
        o('3 backups taken once a year'),
      ]),
      mc('Data classification helps an organization:', 20, [
        o('Apply the right level of protection based on sensitivity', true),
        o('Delete all of its data safely'),
        o('Make every file public'),
        o('Avoid keeping any records'),
      ]),
      tf('Privacy regulations such as GDPR can require organizations to protect and limit the use of personal data.', true),
    ],
  },
  {
    title: 'Endpoint & Device Security',
    description: 'Patching, full-disk encryption, EDR, removable media risks, and screen locks.',
    questions: [
      mc('Keeping software patched primarily:', 20, [
        o('Closes known vulnerabilities that attackers exploit', true),
        o('Makes the device run hotter'),
        o('Deletes your personal files'),
        o('Disables the firewall'),
      ]),
      mc('Full-disk encryption (e.g. BitLocker or FileVault) protects data mainly when:', 20, [
        o('A device is lost or stolen', true),
        o('You are actively typing your password'),
        o('The device is connected to Wi-Fi'),
        o('The screen is turned on'),
      ]),
      mc('EDR (Endpoint Detection and Response) provides:', 25, [
        o('Detection, investigation, and response for threats on endpoints', true),
        o('Faster internet on laptops'),
        o('Automatic data backups only'),
        o('A replacement for all network security'),
      ]),
      mc('Plugging an unknown USB drive into your computer can:', 20, [
        o('Introduce malware or a malicious payload', true),
        o('Always speed up the computer'),
        o('Automatically encrypt your files safely'),
        o('Never pose any risk'),
      ]),
      tf('Auto-locking the screen after inactivity reduces the risk of unauthorized access.', true),
    ],
  },
  {
    title: 'Network Attacks & Defenses',
    description: 'DDoS, segmentation, ARP spoofing, intrusion detection, and default-deny rules.',
    questions: [
      mc('A DDoS (Distributed Denial of Service) attack aims to:', 20, [
        o('Overwhelm a service with traffic so it becomes unavailable', true),
        o('Steal passwords from a database'),
        o('Encrypt files for ransom'),
        o('Patch a vulnerability'),
      ]),
      mc('Network segmentation improves security by:', 25, [
        o('Limiting an attacker’s lateral movement between systems', true),
        o('Making the network faster for everyone'),
        o('Removing the need for passwords'),
        o('Encrypting all stored files'),
      ]),
      mc('ARP spoofing on a local network is typically used to:', 25, [
        o('Redirect traffic through the attacker (a man-in-the-middle)', true),
        o('Speed up DNS lookups'),
        o('Back up network configuration'),
        o('Assign more bandwidth to users'),
      ]),
      mc('An Intrusion Detection System (IDS) primarily:', 20, [
        o('Monitors traffic and alerts on suspicious activity', true),
        o('Encrypts all network traffic'),
        o('Replaces the need for a firewall'),
        o('Stores user passwords'),
      ]),
      tf('A default-deny firewall policy is generally more secure than default-allow.', true),
    ],
  },
  {
    title: 'Secure Coding Practices',
    description: 'Input validation, secrets management, dependency hygiene, error handling, and least privilege.',
    questions: [
      mc('The safest way to handle untrusted input is to:', 25, [
        o('Validate and sanitize it against an expected format', true),
        o('Trust it if it comes from a logged-in user'),
        o('Store it directly in the database as-is'),
        o('Reflect it straight back to the page'),
      ]),
      mc('Secrets such as API keys and passwords should be:', 25, [
        o('Stored in a secrets manager or environment, never in source code', true),
        o('Committed to the repository for convenience'),
        o('Emailed to the whole team'),
        o('Hard-coded so they cannot be lost'),
      ]),
      mc('Keeping third-party dependencies up to date helps prevent:', 20, [
        o('Exploitation of known vulnerable libraries', true),
        o('Your code from compiling'),
        o('Users from logging in'),
        o('The need for any testing'),
      ]),
      mc('Showing detailed internal error messages to end users can:', 25, [
        o('Leak sensitive system details that help attackers', true),
        o('Improve the security of the system'),
        o('Encrypt the application automatically'),
        o('Speed up the database'),
      ]),
      tf('Running application components with the minimum privileges they need reduces risk.', true),
    ],
  },
  {
    title: 'Security Frameworks & Compliance',
    description: 'NIST CSF, defense in depth, PCI DSS, ISO 27001, and least privilege.',
    questions: [
      mc('The five core functions of the NIST Cybersecurity Framework are:', 25, [
        o('Identify, Protect, Detect, Respond, Recover', true),
        o('Plan, Build, Test, Ship, Monitor'),
        o('Scan, Patch, Encrypt, Backup, Audit'),
        o('Login, Logout, Lock, Unlock, Reset'),
      ]),
      mc('"Defense in depth" means:', 20, [
        o('Layering multiple independent security controls', true),
        o('Relying on a single strong firewall'),
        o('Hiding servers so no one finds them'),
        o('Encrypting data only once'),
      ]),
      mc('PCI DSS applies to organizations that:', 25, [
        o('Store, process, or transmit payment card data', true),
        o('Only handle public marketing content'),
        o('Have no internet connection'),
        o('Exclusively use open-source software'),
      ]),
      mc('ISO/IEC 27001 is:', 20, [
        o('A standard for an Information Security Management System (ISMS)', true),
        o('A type of firewall hardware'),
        o('An encryption algorithm'),
        o('A programming language'),
      ]),
      tf('The principle of least privilege is a foundational best practice across security frameworks.', true),
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
