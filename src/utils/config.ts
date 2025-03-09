import fs from 'node:fs'
import path from 'node:path'
import yaml from 'yaml'

// 配置接口定义
export interface Config {
  server: {
    port: number
    host: string
  }
  database: {
    tempDir: string
    defaultName: string
    connection: {
      synchronize: boolean
      logging: string[]
    }
  }
  llm: {
    provider: string
    openai: {
      model: string
      temperature: number
      defaultApiUrl: string
      apiKey?: string
    }
  }
  ui: {
    title: string
    welcomeMessage: string
    readyMessage: string
  }
}

// 默认配置
const defaultConfig: Config = {
  server: {
    port: 3000,
    host: 'localhost',
  },
  database: {
    tempDir: 'db2llm',
    defaultName: 'db2llm.sqlite',
    connection: {
      synchronize: false,
      logging: ['error', 'warn'],
    },
  },
  llm: {
    provider: 'openai',
    openai: {
      model: 'gpt-3.5-turbo',
      temperature: 0.3,
      defaultApiUrl: 'https://api.openai.com/v1',
    },
  },
  ui: {
    title: 'DB2LLM - 数据库对话助手',
    welcomeMessage: '欢迎使用 DB2LLM 数据库对话助手！请先连接数据库和配置 LLM API。',
    readyMessage: '我已准备好，跟我来聊吧！',
  },
}

// 配置单例
let config: Config = { ...defaultConfig }

/**
 * 加载配置文件
 * @param configPath 配置文件路径，默认为 'config/config.yaml'
 * @returns 加载后的配置对象
 */
export function loadConfig(configPath: string = 'config/config.yaml'): Config {
  try {
    // 检查配置文件是否存在
    const absolutePath = path.resolve(process.cwd(), configPath)
    if (!fs.existsSync(absolutePath)) {
      console.warn(`配置文件不存在: ${absolutePath}，使用默认配置`)
      return config
    }

    // 读取配置文件
    const fileContent = fs.readFileSync(absolutePath, 'utf-8')
    const loadedConfig = yaml.parse(fileContent)

    // 合并配置
    config = deepMerge(defaultConfig, loadedConfig)
    console.log('配置文件加载成功')

    return config
  } catch (error) {
    console.error('加载配置文件失败:', error)
    return config
  }
}

/**
 * 获取当前配置
 * @returns 当前配置对象
 */
export function getConfig(): Config {
  return config
}

/**
 * 深度合并对象
 * @param target 目标对象
 * @param source 源对象
 * @returns 合并后的对象
 */
function deepMerge<T extends object>(target: T, source: any): T {
  const output = { ...target }

  if (isObject(target) && isObject(source)) {
    for (const key of Object.keys(source)) {
      if (isObject(source[key])) {
        if (!(key in target)) {
          Object.assign(output, { [key]: source[key] })
        } else {
          output[key] = deepMerge(target[key], source[key])
        }
      } else {
        Object.assign(output, { [key]: source[key] })
      }
    }
  }

  return output
}

/**
 * 检查值是否为对象
 * @param item 要检查的值
 * @returns 是否为对象
 */
function isObject(item: any): boolean {
  return item && typeof item === 'object' && !Array.isArray(item)
}
