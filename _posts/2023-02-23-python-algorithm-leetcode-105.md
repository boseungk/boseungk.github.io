---
layout: post
title: 전위, 중위 순회 결과로 이진 트리 구축
subtitle: 파이썬 알고리즘 
categories: Algorithm
tags: [Algorithm]
---
## 전위, 중위 순회 결과로 이진 트리 구축 - leetcode 105번

### 해설
1. 분할정복이 발상의 시작
2. 전위 순회와 중위 순회에서 root에서 left / root / right로 나눠서 재귀적으로 분할정복해서 해결하는 것이 핵심
3. pop하는 시점이 어디냐에 따라서 전/중/후위 순회가 결정됨(방문기록 작성하는것과 비슷)
4. dfs()를 따로 정의하지 않고 그 함수 그대로 재귀적으로 접근할떄, deque에다가 list를 넣는 방식은 pop이 영향을 미치지 않아서 원하는 결과가 도출되지 않을 수 있음! (주의)

### 풀이(잘못 푼거)

```python
class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right


class Solution:

    def solution(self, preorder: List[int], inorder: List[int]) -> int:
        if inorder:
            queue = collections.deque(preorder)
            mid = queue.popleft()
            index = inorder.index(mid)
            node = TreeNode(mid)
            node.left = self.solution(queue, inorder[:index])
            node.right = self.solution(queue, inorder[index+1:])
        return node

preorder = [3, 9, 20, 15, 7]
inorder = [9, 3, 15, 20, 7]

result = Solution().solution(preorder, inorder)
```
### 해설
```python
    class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right


class Solution:

    def solution(self, preorder: List[int], inorder: List[int]) -> int:
        queue = collections.deque(preorder)
        def dfs(queue, inorder):
            if inorder:
                index = inorder.index(queue.popleft())
                node = TreeNode(inorder[index])
                node.left = dfs(queue, inorder[0:index])
                node.right = dfs(queue, inorder[index + 1:])
                return node
        return dfs(queue, inorder)


preorder = [3, 9, 20, 15, 7]
inorder = [9, 3, 15, 20, 7]

result = Solution().solution(preorder, inorder)
print(result.val)
```