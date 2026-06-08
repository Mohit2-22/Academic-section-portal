import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Play, Trash2, Database, Code2 } from 'lucide-react';
import Editor from '@monaco-editor/react';
import api from '../../api/client';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import toast from 'react-hot-toast';

const LANGUAGES = [
  { id: 'sql', label: 'SQL' },
  { id: 'java', label: 'Java' },
  { id: 'cpp', label: 'C++' },
  { id: 'python', label: 'Python' },
  { id: 'javascript', label: 'JavaScript' },
];

const STARTERS = {
  sql: `-- Sample Schema:
-- students(id, name, age, grade, city)
-- courses(id, title, credits)
-- enrollments(student_id, course_id)

-- Example Query:
SELECT s.name, c.title
FROM students s
JOIN enrollments e ON s.id = e.student_id
JOIN courses c ON c.id = e.course_id
WHERE s.grade = 'A';`,
  java: `public class Main {
    public static void main(String[] args) {
        System.out.println("Hello from Java!");
        for (int i = 1; i <= 5; i++) {
            System.out.println("Count: " + i);
        }
    }
}`,
  cpp: `#include <iostream>
using namespace std;

int main() {
    cout << "Hello from C++!" << endl;
    for (int i = 1; i <= 5; i++) {
        cout << "Count: " << i << endl;
    }
    return 0;
}`,
  python: `# Python Practice
def greet(name):
    return f"Hello, {name}!"

print(greet("Student"))

# Try some calculations
numbers = [1, 2, 3, 4, 5]
print(f"Sum: {sum(numbers)}")
print(f"Average: {sum(numbers)/len(numbers)}")`,
  javascript: `// JavaScript Practice
function greet(name) {
    return "Hello, " + name + "!";
}

console.log(greet("Student"));

// Try some calculations
const numbers = [1, 2, 3, 4, 5];
console.log("Sum:", numbers.reduce((a, b) => a + b, 0));
console.log("Average:", numbers.reduce((a, b) => a + b, 0) / numbers.length);`,
};

const SQL_SCHEMA = `CREATE TABLE students (
  id INT PRIMARY KEY,
  name VARCHAR(100),
  age INT,
  grade VARCHAR(2),
  city VARCHAR(100)
);

CREATE TABLE courses (
  id INT PRIMARY KEY,
  title VARCHAR(200),
  credits INT
);

CREATE TABLE enrollments (
  student_id INT,
  course_id INT,
  FOREIGN KEY (student_id) REFERENCES students(id),
  FOREIGN KEY (course_id) REFERENCES courses(id)
);

-- Sample Data
-- INSERT INTO students VALUES
-- (1, 'Alice', 20, 'A', 'Mumbai'),
-- (2, 'Bob', 22, 'B', 'Delhi');`;

const MONACO_LANG_MAP = {
  sql: 'sql',
  java: 'java',
  cpp: 'cpp',
  python: 'python',
  javascript: 'javascript',
};

export default function PracticeIDE() {
  const [language, setLanguage] = useState('python');
  const [code, setCode] = useState(STARTERS.python);
  const [output, setOutput] = useState('');
  const [running, setRunning] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleLanguageChange = (langId) => {
    setLanguage(langId);
    setCode(STARTERS[langId] || '');
    setOutput('');
  };

  const runCode = useCallback(() => {
    setRunning(true);
    setOutput('Running...\n');

    setTimeout(() => {
      try {
        if (language === 'python') {
          const lines = [];
          const originalLog = console.log;
          const originalError = console.error;
          console.log = (...args) => lines.push(args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' '));
          console.error = (...args) => lines.push('Error: ' + args.map(a => String(a)).join(' '));

          try {
            const result = eval(code);
            if (result !== undefined) lines.push('=> ' + (typeof result === 'object' ? JSON.stringify(result, null, 2) : String(result)));
          } catch (e) {
            lines.push('Error: ' + e.message);
          }

          console.log = originalLog;
          console.error = originalError;
          setOutput(lines.join('\n') || '(no output)');
        } else if (language === 'javascript') {
          const lines = [];
          const originalLog = console.log;
          const originalError = console.error;
          console.log = (...args) => lines.push(args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' '));
          console.error = (...args) => lines.push('Error: ' + args.map(a => String(a)).join(' '));

          try {
            const fn = new Function(code);
            const result = fn();
            if (result !== undefined) lines.push('=> ' + (typeof result === 'object' ? JSON.stringify(result, null, 2) : String(result)));
          } catch (e) {
            lines.push('Error: ' + e.message);
          }

          console.log = originalLog;
          console.error = originalError;
          setOutput(lines.join('\n') || '(no output)');
        } else if (language === 'sql') {
          setOutput(
`-- SQL Execution (Demo Mode)
-- In a real environment, this would run against a database.
-- Your query:
${code}

-- Sample Result:
+--------+------------------+
| name   | title            |
+--------+------------------+
| Alice  | Database 101     |
| Bob    | Python Basics    |
+--------+------------------+
2 rows returned`
          );
        } else {
          setOutput(
`-- ${language.toUpperCase()} Execution (Demo Mode)
-- Client-side execution is not available for ${language}.
-- In production, this code would be sent to a backend compiler.

Code:
${code}

Output:
[Compilation/Execution would happen server-side]`
          );
        }
      } catch (e) {
        setOutput('Runtime Error: ' + e.message);
      }
      setRunning(false);
    }, 500);
  }, [code, language]);

  const clearOutput = () => setOutput('');

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ height: 'calc(100vh - 140px)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>Practice IDE</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Write and test code in your browser</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 10, padding: 4 }}>
            {LANGUAGES.map(l => (
              <button
                key={l.id}
                onClick={() => handleLanguageChange(l.id)}
                style={{
                  padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
                  fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-body)',
                  background: language === l.id ? l.id === 'sql' ? '#10B981' : '#6366F1' : 'transparent',
                  color: language === l.id ? '#fff' : 'var(--text-muted)',
                  transition: 'all 0.2s',
                }}
              >
                {l.label}
              </button>
            ))}
          </div>
          <button className="btn-grad" onClick={runCode} disabled={running}
            style={{
              background: 'linear-gradient(135deg, #10B981, #059669)',
              padding: '8px 18px', fontSize: 13,
              opacity: running ? 0.6 : 1,
            }}
          >
            <Play size={16} fill="#fff" /> Run
          </button>
          <button onClick={clearOutput} style={{
            background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)',
            borderRadius: 10, padding: '8px 14px', color: 'var(--text-muted)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6, fontSize: 13,
          }}>
            <Trash2 size={16} /> Clear
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16, flex: 1, minHeight: 0 }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
          <div className="glass-card" style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
            {mounted && (
              <Editor
                height="100%"
                language={MONACO_LANG_MAP[language] || 'plaintext'}
                value={code}
                onChange={setCode}
                theme="vs-dark"
                options={{
                  minimap: { enabled: false },
                  fontSize: 14,
                  padding: { top: 12 },
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  lineNumbers: 'on',
                  tabSize: 2,
                }}
              />
            )}
          </div>
          <div className="glass-card" style={{
            height: 160, overflow: 'auto', padding: 14, fontFamily: 'monospace',
            fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap', color: output.includes('Error') ? '#F87171' : '#34D399',
          }}>
            {output || <span style={{ color: 'var(--text-muted)' }}>Click "Run" to see output here...</span>}
          </div>
        </div>

        {language === 'sql' && (
          <div className="glass-card" style={{ width: 300, padding: 16, overflow: 'auto', flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Database size={16} color="#10B981" />
              <h3 style={{ fontSize: 14, fontWeight: 600 }}>Sample Schema</h3>
            </div>
            <pre style={{ fontFamily: 'monospace', fontSize: 12, lineHeight: 1.6, color: 'var(--text-muted)', whiteSpace: 'pre-wrap' }}>{SQL_SCHEMA}</pre>
          </div>
        )}
      </div>
    </motion.div>
  );
}
