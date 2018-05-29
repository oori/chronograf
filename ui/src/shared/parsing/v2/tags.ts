import _ from 'lodash'

import {ScriptResult} from 'src/types'
import {parseResults} from 'src/shared/parsing/v2/results'

const parseTags = (resp: string): string[] => {
  const results = parseResults(resp)

  if (results.length === 0) {
    return []
  }

  const tags = results.reduce<string[]>((acc, result: ScriptResult) => {
    const colIndex = result.data[0].findIndex(header => header === '_value')
    const resultTags = result.data.slice(1).map(row => row[colIndex])

    return [...acc, ...resultTags]
  }, [])

  return _.sortBy(tags, t => t.toLocaleLowerCase())
}

export default parseTags