import { getDataSource } from './connection'

export interface TableMetadata {
  name: string
  columns: ColumnMetadata[]
  foreignKeys: ForeignKeyMetadata[]
  indices: IndexMetadata[]
}

export interface ColumnMetadata {
  name: string
  type: string
  isPrimary: boolean
  isNullable: boolean
  default?: string
}

export interface ForeignKeyMetadata {
  columnName: string
  referencedTableName: string
  referencedColumnName: string
}

export interface IndexMetadata {
  name: string
  columnNames: string[]
  isUnique: boolean
}

/**
 * 获取数据库中所有表的元数据
 * @returns 所有表的元数据
 */
export async function getAllTablesMetadata(): Promise<TableMetadata[]> {
  const dataSource = getDataSource()
  const queryRunner = dataSource.createQueryRunner()

  try {
    // 获取所有表名
    const tables = await queryRunner.query(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'typeorm_%'
    `)

    const tablesMetadata: TableMetadata[] = []

    // 获取每个表的详细信息
    for (const table of tables) {
      const tableName = table.name

      // 使用引号包裹表名以处理 SQL 关键字
      const quotedTableName = `"${tableName}"`

      // 获取表的列信息
      const columns = await queryRunner.query(`PRAGMA table_info(${quotedTableName})`)

      // 获取外键信息
      const foreignKeys = await queryRunner.query(`PRAGMA foreign_key_list(${quotedTableName})`)

      // 获取索引信息
      const indices = await queryRunner.query(`PRAGMA index_list(${quotedTableName})`)

      // 获取每个索引的详细信息
      const indexDetails = await Promise.all(
        indices.map(async (idx: any) => ({
          ...idx,
          columns: await queryRunner.query(`PRAGMA index_info("${idx.name}")`),
        })),
      )

      const columnsMetadata: ColumnMetadata[] = columns.map((column: any) => ({
        name: column.name,
        type: column.type,
        isPrimary: column.pk === 1,
        isNullable: column.notnull === 0,
        default: column.dflt_value,
      }))

      const fks: ForeignKeyMetadata[] = foreignKeys.map((fk: any) => ({
        columnName: fk.from,
        referencedTableName: fk.table,
        referencedColumnName: fk.to,
      }))

      const indexMetadata: IndexMetadata[] = indexDetails.map((idx: any) => ({
        name: idx.name,
        columnNames: idx.columns.map((col: any) => col.name),
        isUnique: idx.unique === 1,
      }))

      tablesMetadata.push({
        name: tableName,
        columns: columnsMetadata,
        foreignKeys: fks,
        indices: indexMetadata,
      })
    }

    return tablesMetadata
  } finally {
    await queryRunner.release()
  }
}

/**
 * 获取数据库元数据的文本描述
 * @returns 数据库结构的文本描述
 */
export async function getDatabaseDescription(): Promise<string> {
  const tables = await getAllTablesMetadata()

  let description = `数据库包含 ${tables.length} 个表:\n\n`

  for (const table of tables) {
    description += `表名: ${table.name}\n`
    description += '列:\n'

    for (const column of table.columns) {
      description += `  - ${column.name} (${column.type})`
      if (column.isPrimary) {
        description += ' [主键]'
      }
      if (!column.isNullable) {
        description += ' [非空]'
      }
      if (column.default) {
        description += ` [默认值: ${column.default}]`
      }
      description += '\n'
    }

    if (table.foreignKeys.length > 0) {
      description += '外键:\n'
      for (const fk of table.foreignKeys) {
        description += `  - ${fk.columnName} -> ${fk.referencedTableName}.${fk.referencedColumnName}\n`
      }
    }

    if (table.indices.length > 0) {
      description += '索引:\n'
      for (const idx of table.indices) {
        description += `  - ${idx.name} (${idx.columnNames.join(', ')})`
        if (idx.isUnique) {
          description += ' [唯一]'
        }
        description += '\n'
      }
    }

    description += '\n'
  }

  return description
}
