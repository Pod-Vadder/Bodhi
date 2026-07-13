import { describe, expect, it } from 'vitest';
import { classifyProcBody } from '../src/extract-procs';
import { schemaMarkdown } from '../src/extract-schema';

describe('classifyProcBody', () => {
  it('flags scoring-relevant procedure bodies', () => {
    expect(classifyProcBody('SELECT StenScore FROM StenLookup')).toContain('sten');
    expect(classifyProcBody('UPDATE CareerSuitability SET ...')).toContain('csr');
    expect(classifyProcBody("EXEC sp_executesql @sql")).toContain('dynamic-sql');
    expect(classifyProcBody('SELECT 1')).toEqual([]);
  });
});

describe('schemaMarkdown', () => {
  it('renders a table summary', () => {
    const md = schemaMarkdown([
      {
        schema: 'dbo',
        table: 'Users',
        rowCount: 42,
        columns: [
          {
            table: 'Users',
            column: 'Id',
            ordinal: 1,
            dataType: 'int',
            maxLength: null,
            nullable: false,
            default: null,
          },
        ],
        primaryKey: ['Id'],
        foreignKeys: [],
      },
    ]);
    expect(md).toContain('| dbo.Users | 42 | 1 | Id | 0 |');
  });
});
