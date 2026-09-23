import { supabase } from '../../core/config.js';

/**
 * Results Engine - Academic Performance Analytics
 * Calculates student averages, class positions, and generates professional report cards
 */

class ResultsEngine {
    constructor() {
        this.gradingScale = {
            'A1': { min: 75, max: 100, remark: 'Excellent' },
            'B2': { min: 70, max: 74, remark: 'Very Good' },
            'B3': { min: 65, max: 69, remark: 'Good' },
            'C4': { min: 60, max: 64, remark: 'Credit' },
            'C5': { min: 55, max: 59, remark: 'Credit' },
            'C6': { min: 50, max: 54, remark: 'Credit' },
            'D7': { min: 45, max: 49, remark: 'Pass' },
            'E8': { min: 40, max: 44, remark: 'Pass' },
            'F9': { min: 0,  max: 39, remark: 'Fail' },
        };
    }

    /**
     * Get grade remark from percentage
     */
    getGradeRemark(percentage) {
        for (const [grade, info] of Object.entries(this.gradingScale)) {
            if (percentage >= info.min && percentage <= info.max) {
                return info.remark;
            }
        }
        return 'N/A';
    }

    /**
     * Calculate class average for a specific subject
     */
    async calculateSubjectAverage(studentId, subjectId, term = 'First Term') {
        try {
            const { data: grades, error } = await supabase
                .from('Grades')
                .select('score, max_score')
                .eq('student_id', studentId)
                .eq('subject_id', subjectId)
                .eq('term', term);

            if (error) throw error;

            if (!grades || grades.length === 0) return null;

            const totalScore = grades.reduce((sum, grade) => sum + grade.score, 0);
            const totalMaxScore = grades.reduce((sum, grade) => sum + grade.max_score, 0);
            const averagePercentage = (totalScore / totalMaxScore) * 100;

            return {
                averagePercentage: Math.round(averagePercentage * 100) / 100,
                letterGrade: this.getLetterGrade(averagePercentage),
                totalAssignments: grades.length,
                averageScore: Math.round(totalScore / grades.length * 100) / 100
            };
        } catch (error) {
            console.error('Error calculating subject average:', error);
            return null;
        }
    }

    /**
     * Get letter grade from percentage (WAEC/NECO A1–F9 scale)
     */
    getLetterGrade(percentage) {
        for (const [grade, info] of Object.entries(this.gradingScale)) {
            if (percentage >= info.min && percentage <= info.max) {
                return grade;
            }
        }
        return 'F9';
    }

    /**
     * Compute CA1/CA2/Exam breakdown per subject (by assessment_type).
     * Uses existing Grades rows — no schema changes required.
     * Returns { subject_id: { CA1:{score,max,pct}, CA2:{...}, Exam:{...}, Total:{...} } }.
     */
    async getAssessmentBreakdown(studentId, term = 'First Term') {
        try {
            const { data: grades, error } = await supabase
                .from('Grades')
                .select('subject_id, score, max_score, assessment_type')
                .eq('student_id', studentId)
                .eq('term', term);
            if (error) throw error;
            if (!grades || grades.length === 0) return {};

            const out = {};
            grades.forEach(g => {
                const sid = g.subject_id;
                if (!out[sid]) out[sid] = { CA1: null, CA2: null, Exam: null, Total: null };
                const at = (g.assessment_type || '').toUpperCase();
                const sc = parseFloat(g.score) || 0;
                const mx = parseFloat(g.max_score) || 0;
                const slot = { score: sc, max: mx, pct: mx > 0 ? (sc / mx) * 100 : null };
                if (at === 'CA1') out[sid].CA1 = slot;
                else if (at === 'CA2') out[sid].CA2 = slot;
                else if (at === 'EXAM') out[sid].Exam = slot;
            });

            Object.keys(out).forEach(sid => {
                const b = out[sid];
                let tsc = 0, tmx = 0, any = false;
                ['CA1', 'CA2', 'Exam'].forEach(k => {
                    if (b[k] && b[k].score != null) { tsc += b[k].score; tmx += b[k].max; any = true; }
                });
                if (any && tmx > 0) b.Total = { score: tsc, max: tmx, pct: (tsc / tmx) * 100 };
            });
            return out;
        } catch (e) {
            console.error('Error computing assessment breakdown:', e);
            return {};
        }
    }

    /**
     * Calculate overall class performance
     */
    async calculateClassPerformance(classId, term = 'First Term') {
        try {
            // Get all students in the class
            const { data: students, error } = await supabase
                .from('Students')
                .select('student_id, full_name')
                .eq('class_id', classId);

            if (error) throw error;

            if (!students || students.length === 0) {
                return {
                    totalStudents: 0,
                    classAverage: 0,
                    gradeDistribution: {},
                    topPerformers: []
                };
            }

            // Calculate performance for each student
            const studentPerformances = await Promise.all(
                students.map(async (student) => {
                    const performance = await this.calculateStudentPerformance(student.student_id, term);
                    return {
                        studentId: student.student_id,
                        studentName: student.full_name,
                        ...performance
                    };
                })
            );

            const classAverage = studentPerformances.reduce((sum, student) => {
                const avg = student.studentPerformance?.averagePercentage || 0;
                return sum + avg;
            }, 0) / studentPerformances.length;

            // Calculate grade distribution
            const gradeDistribution = {};
            studentPerformances.forEach(student => {
                const grade = student.studentPerformance?.letterGrade || 'F9';
                gradeDistribution[grade] = (gradeDistribution[grade] || 0) + 1;
            });

            // Get top performers
            const topPerformers = studentPerformances
                .filter(student => student.studentPerformance?.letterGrade && ['A1', 'B2', 'B3'].includes(student.studentPerformance.letterGrade))
                .sort((a, b) => (b.studentPerformance?.averagePercentage || 0) - (a.studentPerformance?.averagePercentage || 0))
                .slice(0, 5);

            return {
                totalStudents: students.length,
                classAverage: Math.round(classAverage * 100) / 100,
                gradeDistribution,
                topPerformers,
                studentPerformances
            };
        } catch (error) {
            console.error('Error calculating class performance:', error);
            return null;
        }
    }

    /**
     * Calculate individual student performance
     */
    async calculateStudentPerformance(studentId, term = 'First Term') {
        try {
            // Get all grades for the student
            const { data: grades, error } = await supabase
                .from('Grades')
                .select('subject_id, score, max_score')
                .eq('student_id', studentId)
                .eq('term', term);

            if (error) throw error;

            if (!grades || grades.length === 0) {
                return {
                    averagePercentage: 0,
                    letterGrade: 'F9',
                    subjectAverages: {},
                    totalAssignments: 0,
                    assessmentBreakdown: {}
                };
            }

            // Group grades by subject
            const subjectGrades = {};
            grades.forEach(grade => {
                if (!subjectGrades[grade.subject_id]) {
                    subjectGrades[grade.subject_id] = [];
                }
                subjectGrades[grade.subject_id].push(grade);
            });

            // Calculate average for each subject
            const subjectAverages = {};
            for (const [subjectId, subjectGradesList] of Object.entries(subjectGrades)) {
                const totalScore = subjectGradesList.reduce((sum, grade) => sum + grade.score, 0);
                const totalMaxScore = subjectGradesList.reduce((sum, grade) => sum + grade.max_score, 0);
                const averagePercentage = (totalScore / totalMaxScore) * 100;

                subjectAverages[subjectId] = {
                    averagePercentage: Math.round(averagePercentage * 100) / 100,
                    letterGrade: this.getLetterGrade(averagePercentage),
                    assignmentCount: subjectGradesList.length
                };
            }

            // Calculate overall average
            const totalScore = grades.reduce((sum, grade) => sum + grade.score, 0);
            const totalMaxScore = grades.reduce((sum, grade) => sum + grade.max_score, 0);
            const overallAveragePercentage = (totalScore / totalMaxScore) * 100;
            const assessmentBreakdown = await this.getAssessmentBreakdown(studentId, term);

            return {
                averagePercentage: Math.round(overallAveragePercentage * 100) / 100,
                letterGrade: this.getLetterGrade(overallAveragePercentage),
                subjectAverages,
                totalAssignments: grades.length,
                assessmentBreakdown
            };
        } catch (error) {
            console.error('Error calculating student performance:', error);
            return null;
        }
    }

    /**
     * Generate professional report card
     */
    async generateReportCard(studentId, term = 'First Term') {
        try {
            const { data: student, error } = await supabase
                .from('Students')
                .select('full_name, admission_date, class_id')
                .eq('student_id', studentId)
                .single();

            if (error) throw error;

            const performance = await this.calculateStudentPerformance(studentId, term);
            if (!performance) throw new Error('Unable to calculate performance data');

            const { data: classData } = await supabase
                .from('Classes')
                .select('class_name, section')
                .eq('class_id', student.class_id)
                .single();

            const reportCard = {
                studentInfo: {
                    name: student.full_name,
                    admissionNumber: student.student_id,
                    admissionDate: student.admission_date,
                    class: `${classData?.class_name || 'N/A'} ${classData?.section || ''}`.trim()
                },
                academicPerformance: {
                    term,
                    overallGPA: this.getGradeRemark(performance.averagePercentage),
                    overallGrade: performance.letterGrade,
                    subjectAverages: performance.subjectAverages,
                    assessmentBreakdown: performance.assessmentBreakdown || {}
                },
                generatedAt: new Date().toISOString()
            };

            return reportCard;
        } catch (error) {
            console.error('Error generating report card:', error);
            return null;
        }
    }

    /**
     * Export report card as PDF using jsPDF (UMD via CDN, window.jspdf.jsPDF).
     * Renders a real formatted result sheet (header, subject columns incl.
     * CA1/CA2/Exam when breakdown data exists, grade/position/remark, footer).
     * Falls back to text download only if jsPDF is unavailable.
     */
    exportReportCardToPDF(reportCard) {
        const student = reportCard.studentInfo || {};
        const perf = reportCard.academicPerformance || {};
        const breakdown = perf.assessmentBreakdown || {};
        const subjects = Object.entries(perf.subjectAverages || {});

        // ── jsPDF path (preferred) ────────────────────────────────
        if (window.jspdf && window.jspdf.jsPDF) {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF({ unit: 'pt', format: 'a4' });
            const pageW = doc.internal.pageSize.getWidth();
            const margin = 48;
            const maxW = pageW - margin * 2;
            let y = margin;

            // Header (school name / title / term)
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(14);
            doc.text('ACADEMIC REPORT CARD', pageW / 2, y, { align: 'center' });
            y += 18;
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(10);
            doc.text(`Student: ${student.name || 'N/A'}`, margin, y); y += 13;
            doc.text(`Admission No.: ${student.admissionNumber || 'N/A'}`, margin, y); y += 13;
            doc.text(`Class: ${student.class || 'N/A'}`, margin, y); y += 13;
            doc.text(`Admission Date: ${student.admissionDate ? new Date(student.admissionDate).toLocaleDateString() : 'N/A'}`, margin, y); y += 13;
            doc.text(`Term: ${perf.term || 'N/A'}`, margin, y); y += 18;

            // Table head
            const colX = {
                subject: margin,
                ca1: margin + 150,
                ca2: margin + 200,
                exam: margin + 250,
                total: margin + 300,
                grade: margin + 355,
                remark: margin + 405
            };
            const colHead = ['Subject', 'CA1', 'CA2', 'Exam', 'Total', 'Grade', 'Remark'];
            const colPos = Object.values(colX);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9);
            colHead.forEach((h, i) => doc.text(h, colPos[i], y));
            y += 8;
            doc.line(margin, y, pageW - margin, y);
            y += 12;
            doc.setFont('helvetica', 'normal');

            subjects.forEach(([sid, data]) => {
                if (y > 760) { doc.addPage(); y = margin; doc.setFont('helvetica','bold'); doc.setFontSize(9); colHead.forEach((h,i)=>doc.text(h, colPos[i], y)); y += 8; doc.line(margin, y, pageW-margin, y); y += 12; doc.setFont('helvetica','normal'); }
                const bd = breakdown[sid] || {};
                const ca1 = bd.CA1 ? (bd.CA1.score ?? '-') : '-';
                const ca2 = bd.CA2 ? (bd.CA2.score ?? '-') : '-';
                const ex = bd.Exam ? (bd.Exam.score ?? '-') : '-';
                const tot = bd.Total ? bd.Total.score ?? '-' : '-';
                doc.text(String(sid).slice(0, 16), colX.subject, y);
                doc.text(String(ca1), colX.ca1, y);
                doc.text(String(ca2), colX.ca2, y);
                doc.text(String(ex), colX.exam, y);
                doc.text(String(tot), colX.total, y);
                doc.text(data.letterGrade || 'N/A', colX.grade, y);
                doc.setFontSize(7.5);
                doc.text(String(data.averagePercentage ?? '') + '%', colX.remark, y);
                doc.setFontSize(9);
                y += 12;
            });
            y += 8;
            doc.line(margin, y, pageW - margin, y);
            y += 14;

            // Summary
            doc.setFont('helvetica', 'bold');
            doc.text(`Overall Grade: ${perf.overallGrade || 'N/A'}`, margin, y);
            y += 13;
            doc.text(`Grade Remark: ${perf.overallGPA || 'N/A'}`, margin, y);
            y += 13;
            doc.text(`Total Assignments/Assessments: ${perf.totalAssignments || 0}`, margin, y);
            y += 22;
            doc.setFont('helvetica', 'normal');
            doc.text(`Generated: ${new Date(reportCard.generatedAt || Date.now()).toLocaleString()}`, margin, y);

            const fname = `report-card-${(student.admissionNumber || student.id || 'student').toString().replace(/[^a-zA-Z0-9]/g, '-')}.pdf`;
            doc.save(fname);
            return;
        }

        // ── Fallback: text download ──────────────────────────────
        const reportText = this.formatReportCardForText(reportCard);
        this.downloadReport(reportText, `report-card-${reportCard.studentInfo.admissionNumber}.txt`);
    }

    /**
     * Format report card for text download
     */
    formatReportCardForText(reportCard) {
        return `
ACADEMIC REPORT CARD
========================

Student Information:
-------------------
Name: ${reportCard.studentInfo.name}
Admission Number: ${reportCard.studentInfo.admissionNumber}
Admission Date: ${new Date(reportCard.studentInfo.admissionDate).toLocaleDateString()}
Class: ${reportCard.studentInfo.class}

Academic Performance:
-------------------
Term: ${reportCard.academicPerformance.term}
Grade Remark: ${reportCard.academicPerformance.overallGPA}
Overall Grade: ${reportCard.academicPerformance.overallGrade}

Subject Breakdown:
-------------------
${Object.entries(reportCard.academicPerformance.subjectAverages)
    .map(([subjectId, data]) => 
        `${subjectId}: ${data.averagePercentage}% (${data.letterGrade}) - ${data.assignmentCount} assignments`
    ).join('\n')}

Generated: ${reportCard.generatedAt}
        `;
    }

    /**
     * Download report file
     */
    downloadReport(content, filename) {
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}

// Export the ResultsEngine
export { ResultsEngine };
