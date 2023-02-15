---
layout: post
title: 역순 연결 리스트
subtitle: 파이썬 알고리즘 
categories: Algorithm
tags: [Algorithm]
---
## 역순 연결 리스트 - leetcode 206번

### 문제
[206. Reverse Linked List](https://leetcode.com/problems/reverse-linked-list/)

입력값: 1->2->3->4->5

출력값: 5->4->3->2->1

### 해설 1 (재귀적 풀이)
1. 노드의 값은 변하지 않고 노드를 이동하면서 연결의 방향만 바꿔준다고 생각하자.
   1. 출력값은 마지막 노드인 것을 알 수 있음.
   2. 함수를 새로 정의해서 (필요한 변수: 다음 노드, 이전 노드) 재귀적으로 다음노드와 연결의 방향을 바꾼 노드를 호출해준다.
    
        ex) 1번 노드에서 1번 노드가 None(다음노드)를 가리키게 만들고 동시에 1번 노드의 다음값은 다른 변수에 보관한 후 재귀함수에 대입해서 호출해준다. 
        
        next, node.next = node.next, prev
        return reverse(next, node)
    3. 마지막 노드에서 다음 노드의 값이 None인 경우를 처리해준다.
        
        if not node: return prev


### 풀이 1

```python
class ListNode:
    def __init__(self, val=0, next=None):
        self.val = val
        self.next = next


class Solution:
    def solution(self, head: ListNode) -> ListNode:
        def reverse_movement(node, prev=None):
            if not node: 
                return prev
            next_node, node.next = node.next, prev
            return reverse_movement(next_node, node)


l1 = ListNode(1)
l1.next = ListNode(2)
l1.next.next = ListNode(3)
l1.next.next.next = ListNode(4)
l1.next.next.next.next = ListNode(5)

answer = Solution().solution(l1)
print(answer)

```
### 해설 2 (반복문)
   1. 노드를 이동하면서 새로운 연결관계를 가진 연결리스트를 만들어줌(변수 스왑이랑 비슷)
   2. 출력값은 새로운 연결관계를 가진 연결리스트
   3. 필요한 변수들은 다음 노드, 새로운 연결관계를 가진 노드
        
         next, node.next = node.next, prev

         prev, node = node, next

```python
class ListNode:
    def __init__(self, val=0, next=None):
        self.val = val
        self.next = next


class Solution:
    def solution(self, head: ListNode) -> ListNode:
        node, prev = head, None
        while node:
            next, node.next = node.next, prev
            node, prev = next, node
        return prev


l1 = ListNode(1)
l1.next = ListNode(2)
l1.next.next = ListNode(3)
l1.next.next.next = ListNode(4)
l1.next.next.next.next = ListNode(5)

answer = Solution().solution(l1)
print(answer)

```