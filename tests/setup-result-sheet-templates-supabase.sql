-- Create the result_sheet_templates table
-- Each school manages its own report-card / result-sheet layout templates.
-- The layout is stored as JSON so schools can customize headers, branding,
-- grading emphasis, and per-subject grouping without schema changes.
CREATE TABLE result_sheet_templates (
    id SERIAL PRIMARY KEY,
    school_id UUID NOT NULL REFERENCES Schools(school_id) ON DELETE CASCADE,
    template_name VARCHAR(200) NOT NULL,
    description TEXT,
    layout_config JSONB NOT NULL DEFAULT '{
        "header": {
            "showLogo": true,
            "showSchoolName": true,
            "showAddress": true,
            "showTerm": true,
            "title": "Student Result Sheet"
        },
        "columns": {
            "order": ["subject", "ca1", "ca2", "exam", "total", "grade", "position", "remark"],
            "showCA1": true,
            "showCA2": true,
            "showExam": true,
            "showTotal": true,
            "showGrade": true,
            "showPosition": true,
            "showRemark": true
        },
        "affective": {
            "show": true,
            "attendance": "Present",
            "punctuality": "Punctual",
            "attitudeToWork": "Good",
            "conduct": "Orderly",
            "neatness": "Tidy",
            "speech": "Fluent",
            "handwriting": "Legible"
        },
        "psychomotor": {
            "show": true,
            "handlingTools": "Good",
            "games": "Fair",
            "creativeArts": "Good",
            "musicalSkills": "Fair"
        },
        "remarks": {
            "showClassTeacher": true,
            "classTeacherDefault": "A good term''s work. Encouraged.",
            "showPrincipal": true,
            "principalDefault": "Promoted to the next class."
        },
        "breakdown": {
            "groupBy": "assessment_type",
            "showAverageAndGrade": true
        },
        "gradingScale": "WAEC",
        "accentColor": "#0066cc",
        "footerNote": "This result sheet is computer-generated and does not require a signature."
    }'::jsonb,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_result_sheet_templates_school ON result_sheet_templates(school_id);
CREATE INDEX idx_result_sheet_templates_default ON result_sheet_templates(school_id, is_default);

-- Enable Row Level Security (RLS)
ALTER TABLE result_sheet_templates ENABLE ROW LEVEL SECURITY;

-- Create policies (mirrors study_materials block in setup-supabase.sql)
-- Each school can only see/change its own templates. The auth helper
-- resolves the caller's school_id from user_metadata via auth.jwt().
CREATE POLICY "Public read access for result sheet templates" ON result_sheet_templates
    FOR SELECT USING (
        school_id IN (
            SELECT CAST(auth.jwt() ->> 'school_id' AS UUID)
        )
        OR school_id IN (
            SELECT (um->>'school_id')::uuid
            FROM jsonb_array_elements(
                COALESCE(auth.jwt()->'user_metadata', '[]'::jsonb)
            ) AS um
            WHERE auth.jwt() ->> 'sub' IS NOT NULL
        )
    );

CREATE POLICY "Authenticated users can insert result sheet templates" ON result_sheet_templates
    FOR INSERT WITH CHECK (
        school_id = COALESCE(
            auth.jwt() ->> 'school_id',
            (auth.jwt()->'user_metadata'->>'school_id')
        )::uuid IS NOT NULL
        AND auth.role() = 'authenticated'
    );

CREATE POLICY "Schools can update their own result sheet templates" ON result_sheet_templates
    FOR UPDATE USING (
        school_id IN (
            SELECT CAST(auth.jwt() ->> 'school_id' AS UUID)
        )
        OR school_id IN (
            SELECT (um->>'school_id')::uuid
            FROM jsonb_array_elements(
                COALESCE(auth.jwt()->'user_metadata', '[]'::jsonb)
            ) AS um
        )
    ) WITH CHECK (
        school_id IN (
            SELECT CAST(auth.jwt() ->> 'school_id' AS UUID)
        )
        OR school_id IN (
            SELECT (um->>'school_id')::uuid
            FROM jsonb_array_elements(
                COALESCE(auth.jwt()->'user_metadata', '[]'::jsonb)
            ) AS um
        )
    );

CREATE POLICY "Schools can delete their own result sheet templates" ON result_sheet_templates
    FOR DELETE USING (
        school_id IN (
            SELECT CAST(auth.jwt() ->> 'school_id' AS UUID)
        )
        OR school_id IN (
            SELECT (um->>'school_id')::uuid
            FROM jsonb_array_elements(
                COALESCE(auth.jwt()->'user_metadata', '[]'::jsonb)
            ) AS um
        )
    );

-- Ensure only one default template per school (partial unique index)
CREATE UNIQUE INDEX one_default_template_per_school
    ON result_sheet_templates (school_id)
    WHERE is_default = TRUE;

-- ── Seed one sensible default template per existing school ────────────
-- Idempotent: skipped for schools that already have a default template.
INSERT INTO result_sheet_templates (school_id, template_name, description, layout_config, is_default, is_active)
SELECT
    s.school_id,
    'Standard WAEC/NECO Result Sheet',
    'Default presentable result sheet: header (logo/name/address/term), subject + CA1/CA2/Exam/Total/Grade/Position/Remark columns, affective & psychomotor domains, teacher and principal remarks.',
    (SELECT column_default::text::jsonb
       FROM information_schema.columns
      WHERE table_name = 'result_sheet_templates'
        AND column_name = 'layout_config'),
    TRUE,
    TRUE
FROM "Schools" s
WHERE NOT EXISTS (
    SELECT 1 FROM result_sheet_templates rst
    WHERE rst.school_id = s.school_id AND rst.is_default = TRUE
);
