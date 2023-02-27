---
layout: post
title: 가장 긴 반복 문자 대체
subtitle: 파이썬 알고리즘 
categories: Algorithm
tags: [Algorithm]
---
## 가장 긴 반복 문자 대체 - leetcode 424번

### 문제
[424. Longest Repeating Character Replacement](https://leetcode.com/problems/longest-repeating-character-replacement/)

### 해설 
1. 처음에 윈도우, 투 포인트 사이즈가 작아서 윈도우 - max_char <= k일때는 윈도우 내에서 연속문자의 최댓값이 보장됨
2. 하지만 윈도우의 사이즈가 커지면서 윈도우 - max_char > k가 되면 바꿔야 하는 문자가 많아져서 연속문자의 최댓값이 보장되지 않음
3. 따라서 right를 1 늘렸을때, 윈도우 - max_char > k가 발생하면 left를 줄여주어야 함
4. max()함수로 최댓값을 비교해주어야 할 것 같지만 right -left만으로도 윈도우 내의 연속문자의 최댓값은 보장되지 않아도 전체 문자내에서의 최댓값은 보장됨

```python

        count = collections.Counter()
        left = 0
        for right, char in enumerate(s, 1):
            count[char] += 1
            max_count = count.most_common(1)[0][1]

            if right - left - max_count > k:
                count[s[left]] -= 1
                left += 1
        return right - left
```
