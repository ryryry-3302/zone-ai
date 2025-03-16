import { CommentData } from '../components/CommentsSidebar';

// Define the analysis data structure
export interface RubricScore {
  category: string;
  score: number;
  explanation: string[];
  comments: {
    comment: string;
    start_index: number;
    end_index: number;
  }[];
}

interface ReportGeneratorOptions {
  essayContent: string;
  comments: CommentData[]; // Update to use CommentData type
  wordCount: number;
  analysis?: RubricScore[]; // Optional to maintain backward compatibility
}

export const generateReport = (options: ReportGeneratorOptions): Window | null => {
  const { essayContent, comments, wordCount, analysis = [] } = options;
  
  // Create a new window for the report
  const reportWindow = window.open('', '_blank');
  
  if (!reportWindow) {
    alert('Please allow popups for this site to generate reports');
    return null;
  }
  
  // First, process the essay content to add markers
  let markedEssayContent = essayContent;

  // Ensure we have comments with highlighted text - a safer approach
  const validComments = comments.filter(comment => comment.highlightedText && comment.highlightedText.trim().length > 0);

  // If we don't have highlighted text info in the comments, inform the user
  if (validComments.length === 0 && comments.length > 0) {
    // Add a note to the report that comments won't be linked
    reportWindow.document.write(`
      <div style="background-color: #fee2e2; color: #991b1b; padding: 12px; margin-bottom: 20px; border-radius: 4px;">
        <p style="margin: 0;">Note: Comment highlighting cannot be displayed in this report because the highlighted text data is missing from your comments.</p>
      </div>
    `);
  } else {
    // We have valid comments with highlighted text
    
    // Create a DOM parser to safely process HTML
    const parser = new DOMParser();
    const doc = parser.parseFromString(essayContent, 'text/html');
    
    // Function to find and mark text nodes that match our target
    function markTextInNode(
      node: Node, 
      targetText: string, 
      commentId: string, 
      commentNumber: number
    ): boolean {
      if (node.nodeType === Node.TEXT_NODE) {
        const content = node.textContent || '';
        if (content.includes(targetText)) {
          // Create a wrapper span for the highlighted text
          const wrapper = document.createElement('span');
          wrapper.className = 'essay-comment-mark';
          wrapper.setAttribute('data-comment-id', commentId);
          
          // Set text content to the matched part
          wrapper.textContent = targetText;
          
          // Create a link for the comment number that jumps to the comment
          const link = document.createElement('a');
          link.className = 'comment-number';
          link.href = `#comment-${commentNumber}`; // Add anchor link
          link.textContent = `[${commentNumber}]`;
          wrapper.appendChild(link);
          
          // Replace the text node with the marked-up version
          const beforeText = content.substring(0, content.indexOf(targetText));
          const afterText = content.substring(content.indexOf(targetText) + targetText.length);
          
          if (beforeText) {
            node.parentNode?.insertBefore(document.createTextNode(beforeText), node);
          }
          
          node.parentNode?.insertBefore(wrapper, node);
          
          if (afterText) {
            node.textContent = afterText;
            // Continue searching in the remaining text
            markTextInNode(node, targetText, commentId, commentNumber);
          } else {
            node.parentNode?.removeChild(node);
          }
          
          return true;
        }
      } else if (node.nodeType === Node.ELEMENT_NODE && 
                !['script', 'style', 'textarea'].includes((node as Element).tagName.toLowerCase())) {
        // Process child nodes recursively
        for (let i = 0; i < node.childNodes.length; i++) {
          // If we found and marked the text, we're done with this comment
          if (markTextInNode(node.childNodes[i], targetText, commentId, commentNumber)) {
            return true;
          }
        }
      }
      return false;
    }
    
    // Mark each comment's highlighted text in the document
    validComments.forEach((comment, index) => {
      if (comment.highlightedText) {
        const commentNumber = index + 1;
        markTextInNode(doc.body, comment.highlightedText, comment.id, commentNumber);
      }
    });
    
    // Get the processed HTML with our comment markers
    markedEssayContent = doc.body.innerHTML;
  }

  // Generate the HTML for report
  const reportHTML = generateReportHTML(essayContent, markedEssayContent, comments, analysis, wordCount);

  // Write the report content to the new window
  reportWindow.document.write(reportHTML);
  reportWindow.document.close();
  
  return reportWindow;
};

// Helper functions for scoring
const getProgressBarColor = (score: number): string => {
  if (score >= 4) return '#22c55e'; // green-500
  if (score >= 3) return '#3b82f6'; // blue-500
  if (score >= 2) return '#f59e0b'; // amber-500
  return '#ef4444'; // red-500
};

const getEmoji = (score: number): string => {
  if (score >= 4.5) return '🌟'; // Outstanding
  if (score >= 4) return '😊'; // Great
  if (score >= 3) return '👍'; // Good
  if (score >= 2) return '🤔'; // Needs work
  return '💪'; // Keep trying
};

const getEncouragement = (score: number): string => {
  if (score >= 4.5) return "Outstanding work! You're a writing superstar! 🌟";
  if (score >= 4) return "Amazing job! Your writing skills are fantastic! ⭐";
  if (score >= 3) return "Good work! Keep practicing and you'll get even better! 👍";
  if (score >= 2) return "You're on your way! Let's work on improving together! 💪";
  return "Everyone starts somewhere! Let's build your writing skills together! 🌱";
};

// Main HTML generator
export const generateReportHTML = (
  essayContent: string, 
  markedEssayContent: string, 
  comments: CommentData[], 
  analysis: RubricScore[],
  wordCount: number
): string => {
  const today = new Date();
  const dateString = today.toLocaleDateString('en-US', {
    year: 'numeric', 
    month: 'long', 
    day: 'numeric'
  });

  // Calculate summary grades
  const grades = {
    overall: analysis.length > 0 
      ? parseFloat((analysis.reduce((sum, item) => sum + item.score, 0) / analysis.length).toFixed(1))
      : 0,
    content: analysis.find(r => r.category.includes('Content'))?.score || 0,
    organization: analysis.find(r => r.category.includes('Structure'))?.score || 0,
    voice: analysis.find(r => r.category.includes('Stance'))?.score || 0,
    wordChoice: analysis.find(r => r.category.includes('Word Choice'))?.score || 0,
    fluency: analysis.find(r => r.category.includes('Sentence Fluency'))?.score || 0,
    conventions: analysis.find(r => r.category.includes('Conventions'))?.score || 0
  };

  // Convert numeric score to letter grade
  const getLetterGrade = (score: number): string => {
    if (score >= 4.5) return 'A+';
    if (score >= 4.0) return 'A';
    if (score >= 3.5) return 'B+';
    if (score >= 3.0) return 'B';
    if (score >= 2.5) return 'C+';
    if (score >= 2.0) return 'C';
    if (score >= 1.5) return 'D+';
    if (score >= 1.0) return 'D';
    return 'F';
  };

  // Button toggle script (unchanged)
  const teacherRevisionScript = `
<script>
  function toggleEditMode() {
    const body = document.body;
    body.contentEditable = body.contentEditable === 'true' ? 'false' : 'true';
    document.getElementById('editButton').textContent =
      body.contentEditable === 'true' ? 'Lock Report' : 'Edit Report';
  }
</script>
`;

  // Updated CSS styles with nicer buttons
  const styles = `
  <style>
    body {
      font-family: 'Comic Sans MS', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #374151;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f8fafc;
      counter-reset: comment-counter;
    }
    
    header {
      background: linear-gradient(135deg, #e0f2fe, #dbeafe);
      border-radius: 16px;
      padding: 2rem;
      text-align: center;
      margin-bottom: 2rem;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    }
    
    h1 {
      color: #1e40af;
      font-size: 2.5rem;
      margin-bottom: 0.5rem;
    }
    
    .meta {
      color: #6b7280;
      font-size: 0.95rem;
    }
    
    .scores {
      display: flex;
      flex-direction: column;
      gap: 2rem;
      margin: 2rem 0;
    }

    .overall-score {
      background: linear-gradient(135deg, #e0f2fe, #dbeafe);
      border-radius: 16px;
      padding: 1.5rem;
      text-align: center;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
      max-width: 400px;
      margin: 0 auto 2rem auto;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 1.5rem;
    }

    .score-main {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .overall-score .score-value {
      font-size: 3rem;
      color: #1e40af;
      line-height: 1;
    }

    .overall-score .grade-label {
      font-size: 1.25rem;
      color: #6b7280;
      margin-top: 0.25rem;
    }

    .overall-score .emoji {
      font-size: 2.5rem;
      margin: 0;
    }

    .overall-progress {
      flex-grow: 1;
      max-width: 150px;
    }

    .analysis-section {
      margin-top: 3rem;
    }

    .category-container {
      background: white;
      border-radius: 12px;
      padding: 1.5rem;
      margin-bottom: 1.5rem;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    }

    .category-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 1rem;
      padding-bottom: 0.5rem;
      border-bottom: 2px solid #e5e7eb;
    }

    .category-title {
      font-size: 1.25rem;
      font-weight: bold;
      color: #1e40af;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .category-score {
      font-size: 1.5rem;
      font-weight: bold;
      color: #1e40af;
    }
    
    .progress-bar {
      width: 100%;
      height: 12px;
      background-color: #e5e7eb;
      border-radius: 6px;
      margin: 0.5rem 0;
      overflow: hidden;
    }
    
    .progress-fill {
      height: 100%;
      transition: width 1s ease-in-out;
    }

    .essay-content {
      margin-top: 2rem;
      background: white;
      border-radius: 12px;
      padding: 1.5rem;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    }

    .comments-section {
      margin-top: 3rem;
      background: white;
      border-radius: 12px;
      padding: 1.5rem;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    }

    .comment-box {
      background-color: #fffbeb;
      border-left: 4px solid #fbbf24;
      padding: 15px;
      margin-bottom: 15px;
      border-radius: 0 5px 5px 0;
      position: relative;
    }

    .comment-box::before {
      content: "[" counter(comment-counter) "]";
      position: absolute;
      top: 15px;
      right: 15px;
      color: #2563eb;
      font-weight: bold;
      counter-increment: comment-counter;
    }

    .comment-author {
      font-weight: bold;
      margin-bottom: 5px;
    }

    .comment-content {
      margin-bottom: 5px;
    }

    .resolved .comment-content {
      text-decoration: line-through;
      color: #888;
    }

    .encouragement {
      background: #f0fdf4;
      border-radius: 12px;
      padding: 1rem;
      margin: 2rem 0;
      text-align: center;
      color: #166534;
    }

    /* Highlighted text styles */
    .essay-comment-mark {
      background-color: #fef3c7;
      padding: 0.1em 0;
      border-bottom: 2px solid #f59e0b;
      cursor: pointer;
      position: relative;
    }

    .comment-number {
      color: #f59e0b;
      font-size: 0.75rem;
      font-weight: 600;
      text-decoration: none;
      vertical-align: super;
      margin-left: 4px;
    }

    /* Button Styles */
    .report-btn {
      display: inline-block;
      background-color: #1e40af;
      color: #fff;
      border: none;
      border-radius: 8px;
      padding: 0.75rem 1.25rem;
      cursor: pointer;
      font-size: 1rem;
      margin-right: 0.5rem;
      margin-bottom: 1rem;
      transition: background-color 0.2s ease-in-out;
    }

    .report-btn:hover {
      background-color: #1d4ed8;
    }

    /* Hide certain elements in print */
    .no-print {
      display: inline-block;
    }
    @media print {
      body {
        background: white;
      }
      .no-print {
        display: none;
      }
    }
  </style>
`;

  // Build your sections as before
  const scoresSection = `
  <div class="scores">
    <div class="overall-score">
      <div class="score-main">
        <div>
          <div class="score-value">
            ${grades.overall}/5
          </div>
          <div class="grade-label">
            ${getLetterGrade(grades.overall)}
          </div>
        </div>
        <div class="emoji">
          ${getEmoji(grades.overall)}
        </div>
      </div>
      <div class="overall-progress">
        <div class="progress-bar">
          <div class="progress-fill" 
               style="width: ${(grades.overall/5)*100}%; background-color: ${getProgressBarColor(grades.overall)}">
          </div>
        </div>
      </div>
    </div>
  </div>
`;

  const analysisSection = `
  ${
    analysis && analysis.length > 0 
    ? `
    <div class="analysis-section">
      <h2>Detailed Analysis</h2>
      ${analysis.map(rubric => `
        <div class="category-container">
          <div class="category-header">
            <div class="category-title">
              ${getEmoji(rubric.score)} ${rubric.category}
            </div>
            <div class="category-score">${rubric.score}/5</div>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" 
                 style="width: ${(rubric.score/5)*100}%; background-color: ${getProgressBarColor(rubric.score)}">
            </div>
          </div>
          <div class="rubric-explanation">
            ${rubric.explanation.map(exp => `<p style="margin-top:0.5rem;">${exp}</p>`).join('')}
          </div>
          ${
            rubric.comments && rubric.comments.length > 0 
            ? `
              <div class="rubric-comments" style="margin-top:1rem; padding-top:1rem; border-top: 1px solid #e5e7eb;">
                <h4 style="margin-bottom:0.5rem; font-weight:bold; color:#1e40af;">Specific Comments</h4>
                ${rubric.comments.map(comment => `
                  <div style="background-color:#f9fafb; padding:0.75rem; border-radius:8px; margin-bottom:0.5rem;">
                    ${comment.comment}
                  </div>
                `).join('')}
              </div>
            `
            : ''
          }
        </div>
      `).join('')}
    </div>
    `
    : ''
  }
`;

  const commentsSection = `
  ${
    comments && comments.length > 0 
    ? `
    <div class="section comments-section">
      <h2>Teacher's Comments</h2>
      ${comments.map((comment, index) => {
        const commentNumber = index + 1;
        return `
          <div id="comment-${commentNumber}" class="comment-box${comment.resolved ? ' resolved' : ''}">
            ${
              comment.highlightedText
              ? `
                <div style="font-style:italic; color:#4b5563; margin-bottom:10px; padding:8px 15px; background-color:#fffbeb; border-left:3px solid #fbbf24; border-radius:0 4px 4px 0;">
                  "<span style="background-color:rgba(251, 191, 36, 0.2); padding:2px 0;">${comment.highlightedText}</span>"
                </div>
              `
              : ''
            }
            <div class="comment-author">Teacher noted:</div>
            <div class="comment-content">${comment.text || comment.content}</div>
            ${
              comment.resolved 
              ? '<div style="font-size: 0.8em; color: #047857; margin-top: 5px;">✓ This issue has been resolved</div>' 
              : ''
            }
            <div style="margin-top: 10px; text-align:right;">
              <a href="#top" style="font-size:0.8em; color:#2563eb; text-decoration:none;">↑ Back to essay</a>
            </div>
          </div>
        `;
      }).join('')}
    </div>
    `
    : '<p>No specific comments were added to this essay.</p>'
  }
`;

  // Final HTML
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Essay Evaluation Report</title>
  ${styles}
  ${teacherRevisionScript}
</head>
<body id="top" contenteditable="false">

  <!-- Buttons (no-print so they don't appear in paper version) -->
  <button id="editButton" class="report-btn no-print" onclick="toggleEditMode()">
    Edit Report
  </button>
  <button class="report-btn no-print" onclick="window.print()">
    Print Report
  </button>

  <header>
    <h1>Essay Evaluation Report</h1>
    <div class="meta">Generated on ${dateString} • ${wordCount} words</div>
  </header>

  <!-- Scores section -->
  ${scoresSection}

  <!-- Analysis section -->
  ${analysisSection}

  <!-- Essay content section -->
  <div class="essay-content">
    <h2>Essay Content</h2>
    <div>${markedEssayContent}</div>
  </div>

  <!-- Comments section -->
  ${commentsSection}

  <!-- Encouragement message -->
  <div class="encouragement">
    ${getEncouragement(grades.overall)}
  </div>

  <!-- Footer -->
  <footer style="margin-top:2rem; text-align:center;">
    <p class="meta">Generated by Flair Essay Analysis Tool</p>
  </footer>
</body>
</html>`;
};
