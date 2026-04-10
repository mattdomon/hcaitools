import {
  FormBuilder,
  FormConfig,
  FormField,
  FormSection,
  FieldType,
  ValidationRule,
  ConditionalLogic,
  ExportOptions,
  FormValues,
  FieldOption,
} from '../src/core/formBuilder';

describe('FormBuilder', () => {
  describe('Creation and Initialization', () => {
    test('creates form with default values', () => {
      const config: FormConfig = {
        id: 'test_form',
        title: 'Test Form',
        layout: { sections: [] },
      };
      const builder = new FormBuilder(config);
      expect(builder.getConfig().id).toBe('test_form');
      expect(builder.getConfig().title).toBe('Test Form');
    });

    test('initializes field values correctly for text fields', () => {
      const config: FormConfig = {
        id: 'test_form',
        title: 'Test Form',
        layout: {
          sections: [
            {
              id: 'section1',
              title: 'Section 1',
              fields: [
                FormBuilder.createField('text', 'name', 'Name', { defaultValue: 'John' }),
              ],
            },
          ],
        },
      };
      const builder = new FormBuilder(config);
      expect(builder.getValue('name')).toBe('John');
    });

    test('initializes checkbox fields to false', () => {
      const config: FormConfig = {
        id: 'test_form',
        title: 'Test Form',
        layout: {
          sections: [
            FormBuilder.createSection('Section 1', 'Description'),
          ],
        },
      };
      config.layout.sections[0].fields.push(
        FormBuilder.createField('checkbox', 'agree', 'Agree to terms')
      );
      const builder = new FormBuilder(config);
      expect(builder.getValue('agree')).toBe(false);
    });

    test('initializes multi-select fields to empty array', () => {
      const config: FormConfig = {
        id: 'test_form',
        title: 'Test Form',
        layout: {
          sections: [
            FormBuilder.createSection('Section 1'),
          ],
        },
      };
      config.layout.sections[0].fields.push(
        FormBuilder.createField('multi-select', 'colors', 'Colors')
      );
      const builder = new FormBuilder(config);
      expect(builder.getValue('colors')).toEqual([]);
    });

    test('deep clones config to prevent mutations', () => {
      const config: FormConfig = {
        id: 'test_form',
        title: 'Test Form',
        layout: { sections: [] },
      };
      const builder = new FormBuilder(config);
      const retrievedConfig = builder.getConfig();
      retrievedConfig.title = 'Modified';
      expect(builder.getConfig().title).toBe('Test Form');
    });
  });

  describe('Field Value Management', () => {
    test('sets and gets field values', () => {
      const config = FormBuilder.createConfig('Test Form');
      const builder = new FormBuilder(config);
      builder.setValue('email', 'test@example.com');
      expect(builder.getValue('email')).toBe('test@example.com');
    });

    test('setValues updates multiple values', () => {
      const config = FormBuilder.createConfig('Test Form');
      const builder = new FormBuilder(config);
      const values: FormValues = {
        name: 'John',
        email: 'john@example.com',
        age: 30,
      };
      builder.setValues(values);
      expect(builder.getValue('name')).toBe('John');
      expect(builder.getValue('email')).toBe('john@example.com');
      expect(builder.getValue('age')).toBe(30);
    });

    test('getValues returns all current values', () => {
      const config = FormBuilder.createConfig('Test Form');
      config.layout.sections.push(
        FormBuilder.createSection('Section 1')
      );
      config.layout.sections[0].fields.push(
        FormBuilder.createField('text', 'field1', 'Field 1'),
        FormBuilder.createField('text', 'field2', 'Field 2')
      );
      const builder = new FormBuilder(config);
      builder.setValue('field1', 'value1');
      builder.setValue('field2', 'value2');
      const values = builder.getValues();
      expect(values.field1).toBe('value1');
      expect(values.field2).toBe('value2');
    });
  });

  describe('Validation', () => {
    test('validates required text field', () => {
      const config: FormConfig = {
        id: 'test_form',
        title: 'Test Form',
        layout: {
          sections: [
            {
              id: 'section1',
              fields: [
                FormBuilder.createField('text', 'name', 'Name', { required: true }),
              ],
            },
          ],
        },
      };
      const builder = new FormBuilder(config);
      builder.setValue('name', '');
      builder.validateField('name');
      expect(builder.getFieldError('name')).toContain('Name is required');
    });

    test('validates email format', () => {
      const config: FormConfig = {
        id: 'test_form',
        title: 'Test Form',
        layout: {
          sections: [
            {
              id: 'section1',
              fields: [
                FormBuilder.createField('email', 'email', 'Email', {
                  validation: [{ type: 'email', message: 'Invalid email' }],
                }),
              ],
            },
          ],
        },
      };
      const builder = new FormBuilder(config);
      builder.setValue('email', 'invalid-email');
      builder.validateField('email');
      expect(builder.getFieldError('email')).toContain('Invalid email');
    });

    test('validates minLength constraint', () => {
      const config: FormConfig = {
        id: 'test_form',
        title: 'Test Form',
        layout: {
          sections: [
            {
              id: 'section1',
              fields: [
                FormBuilder.createField('text', 'password', 'Password', {
                  validation: [{ type: 'minLength', value: 8, message: 'Password too short' }],
                }),
              ],
            },
          ],
        },
      };
      const builder = new FormBuilder(config);
      builder.setValue('password', '123');
      builder.validateField('password');
      expect(builder.getFieldError('password')).toContain('Password too short');
    });

    test('validates maxLength constraint', () => {
      const config: FormConfig = {
        id: 'test_form',
        title: 'Test Form',
        layout: {
          sections: [
            {
              id: 'section1',
              fields: [
                FormBuilder.createField('text', 'username', 'Username', {
                  validation: [{ type: 'maxLength', value: 10, message: 'Username too long' }],
                }),
              ],
            },
          ],
        },
      };
      const builder = new FormBuilder(config);
      builder.setValue('username', 'verylongusername');
      builder.validateField('username');
      expect(builder.getFieldError('username')).toContain('Username too long');
    });

    test('validates pattern matching', () => {
      const config: FormConfig = {
        id: 'test_form',
        title: 'Test Form',
        layout: {
          sections: [
            {
              id: 'section1',
              fields: [
                FormBuilder.createField('text', 'zipcode', 'Zip Code', {
                  validation: [{ type: 'pattern', value: '^\\d{5}$', message: 'Invalid zip code' }],
                }),
              ],
            },
          ],
        },
      };
      const builder = new FormBuilder(config);
      builder.setValue('zipcode', '1234');
      builder.validateField('zipcode');
      expect(builder.getFieldError('zipcode')).toContain('Invalid zip code');
    });

    test('validates min numeric value', () => {
      const config: FormConfig = {
        id: 'test_form',
        title: 'Test Form',
        layout: {
          sections: [
            {
              id: 'section1',
              fields: [
                FormBuilder.createField('number', 'age', 'Age', {
                  validation: [{ type: 'min', value: 18, message: 'Must be at least 18' }],
                }),
              ],
            },
          ],
        },
      };
      const builder = new FormBuilder(config);
      builder.setValue('age', 15);
      builder.validateField('age');
      expect(builder.getFieldError('age')).toContain('Must be at least 18');
    });

    test('validates max numeric value', () => {
      const config: FormConfig = {
        id: 'test_form',
        title: 'Test Form',
        layout: {
          sections: [
            {
              id: 'section1',
              fields: [
                FormBuilder.createField('number', 'quantity', 'Quantity', {
                  validation: [{ type: 'max', value: 100, message: 'Cannot exceed 100' }],
                }),
              ],
            },
          ],
        },
      };
      const builder = new FormBuilder(config);
      builder.setValue('quantity', 150);
      builder.validateField('quantity');
      expect(builder.getFieldError('quantity')).toContain('Cannot exceed 100');
    });

    test('validates url format', () => {
      const config: FormConfig = {
        id: 'test_form',
        title: 'Test Form',
        layout: {
          sections: [
            {
              id: 'section1',
              fields: [
                FormBuilder.createField('url', 'website', 'Website', {
                  validation: [{ type: 'url', message: 'Invalid URL' }],
                }),
              ],
            },
          ],
        },
      };
      const builder = new FormBuilder(config);
      builder.setValue('website', 'not-a-url');
      builder.validateField('website');
      expect(builder.getFieldError('website')).toContain('Invalid URL');
    });

    test('validates phone format', () => {
      const config: FormConfig = {
        id: 'test_form',
        title: 'Test Form',
        layout: {
          sections: [
            {
              id: 'section1',
              fields: [
                FormBuilder.createField('phone', 'phone', 'Phone', {
                  validation: [{ type: 'phone', message: 'Invalid phone' }],
                }),
              ],
            },
          ],
        },
      };
      const builder = new FormBuilder(config);
      builder.setValue('phone', 'abc');
      builder.validateField('phone');
      expect(builder.getFieldError('phone')).toContain('Invalid phone');
    });

    test('uses custom validator function', () => {
      const config: FormConfig = {
        id: 'test_form',
        title: 'Test Form',
        layout: {
          sections: [
            {
              id: 'section1',
              fields: [
                {
                  id: 'custom_field',
                  type: 'text',
                  name: 'custom',
                  label: 'Custom',
                  validation: [
                    {
                      type: 'custom',
                      message: 'Custom validation failed',
                      customValidator: (value) => ({
                        valid: value === 'allowed',
                        message: 'Custom validation failed',
                      }),
                    },
                  ],
                },
              ],
            },
          ],
        },
      };
      const builder = new FormBuilder(config);
      builder.setValue('custom', 'not-allowed');
      builder.validateField('custom');
      expect(builder.getFieldError('custom')).toContain('Custom validation failed');
    });

    test('isValid returns true when no errors', () => {
      const config: FormConfig = {
        id: 'test_form',
        title: 'Test Form',
        layout: {
          sections: [
            {
              id: 'section1',
              fields: [
                {
                  id: 'name_field',
                  type: 'text',
                  name: 'name',
                  label: 'Name',
                  validation: [
                    { type: 'required', message: 'Name is required' },
                    { type: 'minLength', value: 1, message: 'Name is required' },
                  ],
                },
              ],
            },
          ],
        },
      };
      const builder = new FormBuilder(config);
      builder.setValue('name', 'John');
      expect(builder.isValid()).toBe(true);
    });

    test('clearErrors removes all errors', () => {
      const config: FormConfig = {
        id: 'test_form',
        title: 'Test Form',
        layout: {
          sections: [
            {
              id: 'section1',
              fields: [
                FormBuilder.createField('text', 'name', 'Name', { required: true }),
              ],
            },
          ],
        },
      };
      const builder = new FormBuilder(config);
      builder.setValue('name', '');
      builder.validate();
      builder.clearErrors();
      expect(Object.keys(builder.getErrors()).length).toBe(0);
    });

    test('validates multiple fields in form', () => {
      const config: FormConfig = {
        id: 'test_form',
        title: 'Test Form',
        layout: {
          sections: [
            {
              id: 'section1',
              fields: [
                FormBuilder.createField('email', 'email', 'Email', {
                  validation: [{ type: 'email', message: 'Invalid email' }],
                }),
                FormBuilder.createField('text', 'name', 'Name', {
                  validation: [{ type: 'minLength', value: 2, message: 'Name too short' }],
                }),
              ],
            },
          ],
        },
      };
      const builder = new FormBuilder(config);
      builder.setValue('email', 'invalid');
      builder.setValue('name', 'J');
      builder.validate();
      const errors = builder.getErrors();
      expect(errors.email).toBeDefined();
      expect(errors.name).toBeDefined();
    });
  });

  describe('Conditional Logic', () => {
    test('evaluates equals condition correctly', () => {
      const config: FormConfig = {
        id: 'test_form',
        title: 'Test Form',
        layout: {
          sections: [
            {
              id: 'section1',
              fields: [
                FormBuilder.createField('select', 'country', 'Country', {
                  options: [
                    { label: 'USA', value: 'usa' },
                    { label: 'Canada', value: 'canada' },
                  ],
                }),
                {
                  id: 'state_field',
                  type: 'text',
                  name: 'state',
                  label: 'State',
                  conditionalLogic: FormBuilder.createConditionalLogic('show', 'country', 'equals', 'usa'),
                },
              ],
            },
          ],
        },
      };
      const builder = new FormBuilder(config);
      builder.setValue('country', 'usa');
      expect(builder.isFieldVisible('state')).toBe(true);

      builder.setValue('country', 'canada');
      expect(builder.isFieldVisible('state')).toBe(false);
    });

    test('evaluates not_equals condition correctly', () => {
      const config: FormConfig = {
        id: 'test_form',
        title: 'Test Form',
        layout: {
          sections: [
            {
              id: 'section1',
              fields: [
                FormBuilder.createField('select', 'status', 'Status', {
                  options: [
                    { label: 'Active', value: 'active' },
                    { label: 'Inactive', value: 'inactive' },
                  ],
                }),
                {
                  id: 'details_field',
                  type: 'text',
                  name: 'details',
                  label: 'Details',
                  conditionalLogic: FormBuilder.createConditionalLogic('show', 'status', 'not_equals', 'inactive'),
                },
              ],
            },
          ],
        },
      };
      const builder = new FormBuilder(config);
      builder.setValue('status', 'active');
      expect(builder.isFieldVisible('details')).toBe(true);

      builder.setValue('status', 'inactive');
      expect(builder.isFieldVisible('details')).toBe(false);
    });

    test('evaluates is_empty condition', () => {
      const config: FormConfig = {
        id: 'test_form',
        title: 'Test Form',
        layout: {
          sections: [
            {
              id: 'section1',
              fields: [
                FormBuilder.createField('text', 'comment', 'Comment'),
                {
                  id: 'optional_field',
                  type: 'text',
                  name: 'optional',
                  label: 'Optional',
                  conditionalLogic: FormBuilder.createConditionalLogic('show', 'comment', 'is_empty'),
                },
              ],
            },
          ],
        },
      };
      const builder = new FormBuilder(config);
      builder.setValue('comment', '');
      expect(builder.isFieldVisible('optional')).toBe(true);

      builder.setValue('comment', 'some text');
      expect(builder.isFieldVisible('optional')).toBe(false);
    });

    test('evaluates contains condition for arrays', () => {
      const config: FormConfig = {
        id: 'test_form',
        title: 'Test Form',
        layout: {
          sections: [
            {
              id: 'section1',
              fields: [
                FormBuilder.createField('multi-select', 'colors', 'Colors', {
                  options: [
                    { label: 'Red', value: 'red' },
                    { label: 'Blue', value: 'blue' },
                  ],
                }),
                {
                  id: 'color_preview',
                  type: 'text',
                  name: 'preview',
                  label: 'Preview',
                  conditionalLogic: FormBuilder.createConditionalLogic('show', 'colors', 'contains', 'red'),
                },
              ],
            },
          ],
        },
      };
      const builder = new FormBuilder(config);
      builder.setValue('colors', ['blue']);
      expect(builder.isFieldVisible('preview')).toBe(false);

      builder.setValue('colors', ['red', 'blue']);
      expect(builder.isFieldVisible('preview')).toBe(true);
    });

    test('evaluates disable action correctly', () => {
      const config: FormConfig = {
        id: 'test_form',
        title: 'Test Form',
        layout: {
          sections: [
            {
              id: 'section1',
              fields: [
                FormBuilder.createField('checkbox', 'is_admin', 'Is Admin'),
                FormBuilder.createField('text', 'admin_code', 'Admin Code', {
                  conditionalLogic: FormBuilder.createConditionalLogic('disable', 'is_admin', 'equals', false),
                }),
              ],
            },
          ],
        },
      };
      const builder = new FormBuilder(config);
      builder.setValue('is_admin', false);
      expect(builder.isFieldDisabled('admin_code')).toBe(true);

      builder.setValue('is_admin', true);
      expect(builder.isFieldDisabled('admin_code')).toBe(false);
    });
  });

  describe('Field Management', () => {
    test('adds new field to section', () => {
      const config = FormBuilder.createConfig('Test Form', [
        FormBuilder.createSection('Section 1'),
      ]);
      const builder = new FormBuilder(config);
      const newField = FormBuilder.createField('text', 'new_field', 'New Field');
      builder.addField(config.layout.sections[0].id, newField);
      expect(builder.getValue('new_field')).toBe('');
    });

    test('removes field from section', () => {
      const config: FormConfig = {
        id: 'test_form',
        title: 'Test Form',
        layout: {
          sections: [
            {
              id: 'section1',
              fields: [
                FormBuilder.createField('text', 'to_remove', 'To Remove'),
              ],
            },
          ],
        },
      };
      const builder = new FormBuilder(config);
      builder.removeField('to_remove');
      expect(builder.getValue('to_remove')).toBeUndefined();
    });

    test('updates existing field', () => {
      const config: FormConfig = {
        id: 'test_form',
        title: 'Test Form',
        layout: {
          sections: [
            {
              id: 'section1',
              fields: [
                FormBuilder.createField('text', 'name', 'Name'),
              ],
            },
          ],
        },
      };
      const builder = new FormBuilder(config);
      builder.updateField('name', { label: 'Full Name', required: true });
      const config_result = builder.getConfig();
      const field = config_result.layout.sections[0].fields[0];
      expect(field.label).toBe('Full Name');
      expect(field.required).toBe(true);
    });

    test('moves field within same section', () => {
      const config: FormConfig = {
        id: 'test_form',
        title: 'Test Form',
        layout: {
          sections: [
            {
              id: 'section1',
              fields: [
                FormBuilder.createField('text', 'field1', 'Field 1'),
                FormBuilder.createField('text', 'field2', 'Field 2'),
                FormBuilder.createField('text', 'field3', 'Field 3'),
              ],
            },
          ],
        },
      };
      const builder = new FormBuilder(config);
      const field1 = config.layout.sections[0].fields[0];
      builder.moveField({
        item: { id: field1.id, type: 'field', index: 0 },
        fromIndex: 0,
        toIndex: 2,
        fromSection: 'section1',
        toSection: 'section1',
      });
      const fields = builder.getConfig().layout.sections[0].fields;
      expect(fields[1].name).toBe('field1');
    });
  });

  describe('Section Management', () => {
    test('adds new section', () => {
      const config = FormBuilder.createConfig('Test Form');
      const builder = new FormBuilder(config);
      const section = FormBuilder.createSection('New Section', 'Description');
      builder.addSection(section);
      expect(builder.getConfig().layout.sections.length).toBe(1);
    });

    test('removes section and cleans up values', () => {
      const config: FormConfig = {
        id: 'test_form',
        title: 'Test Form',
        layout: {
          sections: [
            {
              id: 'section1',
              fields: [
                FormBuilder.createField('text', 'field1', 'Field 1'),
              ],
            },
          ],
        },
      };
      const builder = new FormBuilder(config);
      builder.setValue('field1', 'value1');
      builder.removeSection('section1');
      expect(builder.getConfig().layout.sections.length).toBe(0);
      expect(builder.getValue('field1')).toBeUndefined();
    });

    test('updates section', () => {
      const config: FormConfig = {
        id: 'test_form',
        title: 'Test Form',
        layout: {
          sections: [
            {
              id: 'section1',
              title: 'Original Title',
              fields: [],
            },
          ],
        },
      };
      const builder = new FormBuilder(config);
      builder.updateSection('section1', { title: 'Updated Title', description: 'New description' });
      const updated = builder.getConfig().layout.sections[0];
      expect(updated.title).toBe('Updated Title');
      expect(updated.description).toBe('New description');
    });
  });

  describe('Form Submission', () => {
    test('submits form successfully', async () => {
      const config: FormConfig = {
        id: 'test_form',
        title: 'Test Form',
        layout: {
          sections: [
            {
              id: 'section1',
              fields: [
                {
                  id: 'name_field',
                  type: 'text',
                  name: 'name',
                  label: 'Name',
                  validation: [
                    { type: 'required', message: 'Name is required' },
                  ],
                },
              ],
            },
          ],
        },
      };
      const builder = new FormBuilder(config);
      builder.setValue('name', 'John');
      const submission = await builder.submit();
      expect(submission.formId).toBe('test_form');
      expect(submission.values.name).toBe('John');
      expect(submission.submittedAt).toBeInstanceOf(Date);
    });

    test('throws error when form is invalid', async () => {
      const config: FormConfig = {
        id: 'test_form',
        title: 'Test Form',
        layout: {
          sections: [
            {
              id: 'section1',
              fields: [
                FormBuilder.createField('text', 'name', 'Name', { required: true }),
              ],
            },
          ],
        },
      };
      const builder = new FormBuilder(config);
      builder.setValue('name', '');
      await expect(builder.submit()).rejects.toThrow('Form validation failed');
    });

    test('stores multiple submissions', async () => {
      const config: FormConfig = {
        id: 'test_form',
        title: 'Test Form',
        layout: {
          sections: [
            {
              id: 'section1',
              fields: [
                {
                  id: 'name_field',
                  type: 'text',
                  name: 'name',
                  label: 'Name',
                  validation: [
                    { type: 'required', message: 'Name is required' },
                  ],
                },
              ],
            },
          ],
        },
      };
      const builder = new FormBuilder(config);
      builder.setValue('name', 'John');
      await builder.submit();
      builder.setValue('name', 'Jane');
      await builder.submit();
      const submissions = builder.getSubmissions();
      expect(submissions.length).toBe(2);
      expect(submissions[0].values.name).toBe('John');
      expect(submissions[1].values.name).toBe('Jane');
    });
  });

  describe('Data Export', () => {
    test('exports to JSON format', async () => {
      const config: FormConfig = {
        id: 'test_form',
        title: 'Test Form',
        layout: {
          sections: [
            {
              id: 'section1',
              fields: [
                FormBuilder.createField('text', 'name', 'Name'),
              ],
            },
          ],
        },
      };
      const builder = new FormBuilder(config);
      builder.setValue('name', 'John');
      await builder.submit();

      const options: ExportOptions = { format: 'json' };
      const exported = builder.exportData(options);
      const parsed = JSON.parse(exported);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed[0].name).toBe('John');
    });

    test('exports to JSON with metadata', async () => {
      const config: FormConfig = {
        id: 'test_form',
        title: 'Test Form',
        layout: {
          sections: [
            {
              id: 'section1',
              fields: [
                FormBuilder.createField('text', 'name', 'Name'),
              ],
            },
          ],
        },
      };
      const builder = new FormBuilder(config);
      builder.setValue('name', 'John');
      await builder.submit();

      const options: ExportOptions = { format: 'json', includeMetadata: true };
      const exported = builder.exportData(options);
      const parsed = JSON.parse(exported);
      expect(parsed.formId).toBe('test_form');
      expect(parsed.formTitle).toBe('Test Form');
      expect(parsed.exportedAt).toBeDefined();
    });

    test('exports to CSV format', async () => {
      const config: FormConfig = {
        id: 'test_form',
        title: 'Test Form',
        layout: {
          sections: [
            {
              id: 'section1',
              fields: [
                FormBuilder.createField('text', 'name', 'Name'),
                FormBuilder.createField('email', 'email', 'Email'),
              ],
            },
          ],
        },
      };
      const builder = new FormBuilder(config);
      builder.setValue('name', 'John');
      builder.setValue('email', 'john@example.com');
      await builder.submit();

      const options: ExportOptions = { format: 'csv' };
      const exported = builder.exportData(options);
      const lines = exported.split('\n');
      expect(lines[0]).toContain('name');
      expect(lines[0]).toContain('email');
      expect(lines[1]).toContain('John');
      expect(lines[1]).toContain('john@example.com');
    });

    test('exports to CSV with custom delimiter', async () => {
      const config: FormConfig = {
        id: 'test_form',
        title: 'Test Form',
        layout: {
          sections: [
            {
              id: 'section1',
              fields: [
                FormBuilder.createField('text', 'name', 'Name'),
                FormBuilder.createField('text', 'email', 'Email'),
              ],
            },
          ],
        },
      };
      const builder = new FormBuilder(config);
      builder.setValue('name', 'John');
      builder.setValue('email', 'john@example.com');
      await builder.submit();

      const options: ExportOptions = { format: 'csv', delimiter: ';' };
      const exported = builder.exportData(options);
      const lines = exported.split('\n');
      expect(lines[0]).toContain(';');
      expect(lines[1]).toContain(';');
    });

    test('exports to XML format', async () => {
      const config: FormConfig = {
        id: 'test_form',
        title: 'Test Form',
        layout: {
          sections: [
            {
              id: 'section1',
              fields: [
                FormBuilder.createField('text', 'name', 'Name'),
              ],
            },
          ],
        },
      };
      const builder = new FormBuilder(config);
      builder.setValue('name', 'John');
      await builder.submit();

      const options: ExportOptions = { format: 'xml' };
      const exported = builder.exportData(options);
      expect(exported).toContain('<?xml version="1.0"');
      expect(exported).toContain('<form id="test_form"');
      expect(exported).toContain('<name><![CDATA[John]]></name>');
    });
  });

  describe('Touched Fields', () => {
    test('tracks touched fields after setValue', () => {
      const config = FormBuilder.createConfig('Test Form', [
        FormBuilder.createSection('Section 1'),
      ]);
      config.layout.sections[0].fields.push(
        FormBuilder.createField('text', 'field1', 'Field 1')
      );
      const builder = new FormBuilder(config);
      builder.setValue('field1', 'value');
      expect(builder.isFieldTouched('field1')).toBe(true);
      expect(builder.isFieldTouched('field2')).toBe(false);
    });

    test('getTouchedFields returns all touched field names', () => {
      const config = FormBuilder.createConfig('Test Form', [
        FormBuilder.createSection('Section 1'),
      ]);
      config.layout.sections[0].fields.push(
        FormBuilder.createField('text', 'field1', 'Field 1'),
        FormBuilder.createField('text', 'field2', 'Field 2')
      );
      const builder = new FormBuilder(config);
      builder.setValue('field1', 'value1');
      builder.setValue('field2', 'value2');
      const touched = builder.getTouchedFields();
      expect(touched).toContain('field1');
      expect(touched).toContain('field2');
    });

    test('touchField manually marks field as touched', () => {
      const config = FormBuilder.createConfig('Test Form', [
        FormBuilder.createSection('Section 1'),
      ]);
      config.layout.sections[0].fields.push(
        FormBuilder.createField('text', 'field1', 'Field 1')
      );
      const builder = new FormBuilder(config);
      builder.touchField('field1');
      expect(builder.isFieldTouched('field1')).toBe(true);
    });
  });

  describe('Reset', () => {
    test('resets all values and errors', async () => {
      const config: FormConfig = {
        id: 'test_form',
        title: 'Test Form',
        layout: {
          sections: [
            {
              id: 'section1',
              fields: [
                FormBuilder.createField('text', 'name', 'Name', { defaultValue: 'Default' }),
              ],
            },
          ],
        },
      };
      const builder = new FormBuilder(config);
      builder.setValue('name', 'Custom');
      builder.validate();
      builder.reset();
      expect(builder.getValue('name')).toBe('Default');
      expect(Object.keys(builder.getErrors()).length).toBe(0);
    });
  });

  describe('Static Factory Methods', () => {
    test('createField creates field with correct properties', () => {
      const field = FormBuilder.createField('text', 'test_name', 'Test Label', {
        placeholder: 'Enter text',
        required: true,
      });
      expect(field.type).toBe('text');
      expect(field.name).toBe('test_name');
      expect(field.label).toBe('Test Label');
      expect(field.placeholder).toBe('Enter text');
      expect(field.required).toBe(true);
    });

    test('createSection creates section with id', () => {
      const section = FormBuilder.createSection('Section Title', 'Description');
      expect(section.title).toBe('Section Title');
      expect(section.description).toBe('Description');
      expect(section.id).toMatch(/^section_/);
      expect(section.fields).toEqual([]);
    });

    test('createConfig creates form config with id', () => {
      const config = FormBuilder.createConfig('My Form');
      expect(config.title).toBe('My Form');
      expect(config.id).toMatch(/^form_/);
      expect(config.layout.sections).toEqual([]);
    });

    test('createFieldOption creates option object', () => {
      const option = FormBuilder.createFieldOption('Label', 'value');
      expect(option.label).toBe('Label');
      expect(option.value).toBe('value');
    });

    test('createConditionalLogic creates conditional object', () => {
      const logic = FormBuilder.createConditionalLogic('show', 'field1', 'equals', 'yes');
      expect(logic.action).toBe('show');
      expect(logic.condition.field).toBe('field1');
      expect(logic.condition.operator).toBe('equals');
      expect(logic.condition.value).toBe('yes');
    });

    test('createValidationRule creates validation rule', () => {
      const rule = FormBuilder.createValidationRule('required', 'This field is required');
      expect(rule.type).toBe('required');
      expect(rule.message).toBe('This field is required');
    });

    test('getFieldTemplates returns all templates', () => {
      const templates = FormBuilder.getFieldTemplates();
      expect(templates.length).toBeGreaterThan(0);
      expect(templates.find((t) => t.type === 'text')).toBeDefined();
      expect(templates.find((t) => t.type === 'email')).toBeDefined();
    });
  });

  describe('Hidden and Disabled Fields', () => {
    test('isFieldVisible returns false for hidden fields', () => {
      const config: FormConfig = {
        id: 'test_form',
        title: 'Test Form',
        layout: {
          sections: [
            {
              id: 'section1',
              fields: [
                FormBuilder.createField('text', 'name', 'Name', { hidden: true }),
              ],
            },
          ],
        },
      };
      const builder = new FormBuilder(config);
      expect(builder.isFieldVisible('name')).toBe(false);
    });

    test('isFieldDisabled returns true for disabled fields', () => {
      const config: FormConfig = {
        id: 'test_form',
        title: 'Test Form',
        layout: {
          sections: [
            {
              id: 'section1',
              fields: [
                FormBuilder.createField('text', 'name', 'Name', { disabled: true }),
              ],
            },
          ],
        },
      };
      const builder = new FormBuilder(config);
      expect(builder.isFieldDisabled('name')).toBe(true);
    });
  });
});
